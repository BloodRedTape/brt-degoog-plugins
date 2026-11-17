import { renderCard } from "./render.js";
import { SOURCES } from "./sources/index.js";
import { looseArtist, matchesQuery, sameName } from "./text.js";

const MAX_RESULTS = 10;
const MAX_CANDIDATES = 3;
const SLOT_FETCH_TIMEOUT_MS = 4000;
const ROUTE_FETCH_TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const COVER_ROUTE = "cover";

const LAYOUT = { FULL_WIDTH: "full-width", PANEL: "panel" };
const LAYOUT_POSITION = {
  [LAYOUT.FULL_WIDTH]: "full-width-above-results",
  [LAYOUT.PANEL]: "above-results",
};

let cache = null;
let routeUrl = (path) => `/api/plugin/music-card/${path}`;
let signProxyUrl = null;
let routeFetch = (...args) => fetch(...args);

const _ranked = (results) =>
  results
    .map((result, index) => ({ result, index }))
    .sort((a, b) => (Number(b.result?.score) || 0) - (Number(a.result?.score) || 0) || a.index - b.index)
    .map(({ result }) => result);

const _parseUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
};

const _mentionOf = (result) => {
  const url = _parseUrl(result?.url);
  if (!url) return null;
  url.hostname = url.hostname.toLowerCase().replace(/^(?:www|m)\./, "");
  for (const source of SOURCES) {
    const mention = source.parse(url, String(result?.title || ""));
    if (mention) return { ...mention, source };
  }
  return null;
};

const _mentions = (results) =>
  Array.isArray(results) ? _ranked(results).slice(0, MAX_RESULTS).map(_mentionOf).filter(Boolean) : [];

const _jsonFetcher = (fetchFn, timeoutMs) => async (url) => {
  const cached = cache ? await cache.get(url) : null;
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && cache) await cache.set(url, data);
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const _coverUrl = (mention) => {
  if (typeof mention.source.cover !== "function") return "";
  const params = new URLSearchParams({ s: mention.source.id, kind: mention.kind, id: mention.id });
  return `${routeUrl(COVER_ROUTE)}?${params}`;
};

const _resolveName = async (mention, fetchJson) => {
  if (mention.name) return mention.name;
  if (typeof mention.source.details !== "function") return "";
  const details = await mention.source.details(mention, fetchJson);
  return details?.name || "";
};

const RELEASE_KINDS = new Set(["track", "album"]);

const _compatibleKinds = (a, b) => a === b || (RELEASE_KINDS.has(a) && RELEASE_KINDS.has(b));

const _supports = (main, name, other) =>
  other.source.id !== main.source.id &&
  _compatibleKinds(main.kind, other.kind) &&
  sameName(other.name, name) &&
  (!main.artist || !other.artist || looseArtist(main.artist, other.artist));

const _supporters = (main, name, mentions) => {
  const seen = new Set([main.source.id]);
  return mentions.filter((other) => {
    if (seen.has(other.source.id) || !_supports(main, name, other)) return false;
    seen.add(other.source.id);
    return true;
  });
};

const _linkOf = (mention) => ({
  id: mention.source.id,
  label: mention.source.label,
  icon: mention.source.icon,
  url: mention.url,
});

const _card = async (query, mention, mentions, fetchJson) => {
  const name = await _resolveName(mention, fetchJson);
  if (!name) return null;
  const supporters = _supporters(mention, name, mentions);
  const artist = mention.artist || supporters.find((other) => other.artist)?.artist || "";
  if (!matchesQuery(query, name, artist)) return null;
  return {
    kind: mention.kind,
    name,
    artist,
    url: mention.url,
    image: _coverUrl(mention),
    facts: [{ key: "artist", value: artist }].filter((fact) => fact.value),
    links: [mention, ...supporters].map(_linkOf),
  };
};

const _noCover = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

const _coverRoute = async (request) => {
  const params = new URL(request.url).searchParams;
  const source = SOURCES.find((s) => s.id === params.get("s") && typeof s.cover === "function");
  if (!source || !signProxyUrl) return _noCover();
  const image = await source.cover(params.get("kind"), params.get("id"), _jsonFetcher(routeFetch, ROUTE_FETCH_TIMEOUT_MS));
  if (!image) return _noCover();
  return new Response(null, {
    status: 302,
    headers: { Location: signProxyUrl(image), "Cache-Control": "private, max-age=86400" },
  });
};

export const routes = [{ method: "get", path: COVER_ROUTE, handler: _coverRoute }];

export const slot = {
  isClientExposed: false,
  id: "music-card",
  name: "Music card",
  description: "Shows a song, album or artist card when the results link to it on a music service.",
  position: LAYOUT_POSITION[LAYOUT.PANEL],
  waitForResults: true,

  settingsSchema: [
    {
      key: "layout",
      label: "Layout",
      type: "select",
      options: [LAYOUT.FULL_WIDTH, LAYOUT.PANEL],
      optionLabels: ["Full width above results", "Panel above results"],
      default: LAYOUT.PANEL,
      description: "Where the card appears and how it is framed.",
    },
  ],

  configure(settings) {
    const layout = settings?.layout === LAYOUT.FULL_WIDTH ? LAYOUT.FULL_WIDTH : LAYOUT.PANEL;
    slot.position = LAYOUT_POSITION[layout];
  },

  init(ctx) {
    cache = typeof ctx?.useCache === "function" ? ctx.useCache("ext:music-card:api", CACHE_TTL_MS) : null;
    if (typeof ctx?.routeUrl === "function") routeUrl = (path) => ctx.routeUrl(path);
    if (typeof ctx?.signProxyUrl === "function") signProxyUrl = ctx.signProxyUrl;
    if (typeof ctx?.fetch === "function") routeFetch = (...args) => ctx.fetch(...args);
  },

  trigger() {
    return true;
  },

  async execute(query, context) {
    const mentions = _mentions(context?.results);
    if (!mentions.length) return { html: "" };
    const fetchJson = _jsonFetcher(context?.fetch ?? fetch, SLOT_FETCH_TIMEOUT_MS);
    const candidates = mentions.filter((mention) => mention.source.primary).slice(0, MAX_CANDIDATES);
    for (const mention of candidates) {
      const card = await _card(query, mention, mentions, fetchJson);
      if (!card) continue;
      return { title: "", html: renderCard(card) };
    }
    return { html: "" };
  },
};

export default { slot, routes };

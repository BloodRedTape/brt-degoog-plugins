import { renderCard } from "./render.js";
import { matchesQuery } from "./text.js";
import { fetchFilm, fetchSummary, languageOf } from "./wikidata.js";

const MAX_RESULTS = 10;
const MAX_CANDIDATES = 2;
const FETCH_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = "degoog-movie-card/0.1";
const IMDB_PATH_RE = /^\/(?:[a-z]{2}\/)?title\/(tt\d{7,10})(?:\/|$)/i;

const LAYOUT = { FULL_WIDTH: "full-width", PANEL: "panel" };
const LAYOUT_POSITION = {
  [LAYOUT.FULL_WIDTH]: "full-width-above-results",
  [LAYOUT.PANEL]: "above-results",
};

let cache = null;

const _ranked = (results) =>
  results
    .map((result, index) => ({ result, index }))
    .sort((a, b) => (Number(b.result?.score) || 0) - (Number(a.result?.score) || 0) || a.index - b.index)
    .map(({ result }) => result);

const _imdbId = (value) => {
  try {
    const url = new URL(String(value || ""));
    if (url.hostname.toLowerCase().replace(/^(?:www|m)\./, "") !== "imdb.com") return null;
    const match = IMDB_PATH_RE.exec(url.pathname);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
};

const _imdbIds = (results) =>
  Array.isArray(results)
    ? [...new Set(_ranked(results).slice(0, MAX_RESULTS).map((r) => _imdbId(r?.url)).filter(Boolean))]
    : [];

const _jsonFetcher = (fetchFn) => async (url, accept) => {
  const cached = cache ? await cache.get(url) : null;
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { headers: { Accept: accept, "User-Agent": USER_AGENT }, signal: controller.signal });
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

const _year = (iso) => (/^\d{4}/.test(iso) ? iso.slice(0, 4) : "");

const _matches = (query, film) =>
  matchesQuery(
    query,
    [film.label, film.enLabel, film.title, ...film.names].filter(Boolean),
    [...film.directors, ...film.creators, _year(film.released), _year(film.started)].filter(Boolean),
  );

export const slot = {
  isClientExposed: false,
  id: "movie-card",
  name: "Movie card",
  description: "Shows a film or TV series card when the results link to it on IMDb.",
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
    cache = typeof ctx?.useCache === "function" ? ctx.useCache("ext:movie-card:api", CACHE_TTL_MS) : null;
  },

  trigger() {
    return true;
  },

  async execute(query, context) {
    const ids = _imdbIds(context?.results).slice(0, MAX_CANDIDATES);
    if (!ids.length) return { html: "" };
    const fetchJson = _jsonFetcher(context?.fetch ?? fetch);
    const lang = languageOf(context?.locale);
    for (const id of ids) {
      const film = await fetchFilm(id, lang, fetchJson);
      if (!film || !_matches(query, film)) continue;
      const summary = film.article ? await fetchSummary(film.article, fetchJson) : null;
      const image = summary?.image && context?.signProxyUrl ? context.signProxyUrl(summary.image) : summary?.image || "";
      return { title: "", html: renderCard({ ...film, imdbId: id, summary, image }, lang) };
    }
    return { html: "" };
  },
};

export default { slot };

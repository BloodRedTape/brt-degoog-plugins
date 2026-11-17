import { buildView } from "./forecast.js";
import { renderCard } from "./render.js";
import { SOURCE, pageUrl, parseForecast, parseLink } from "./sinoptik.js";
import { matchesPlace } from "./text.js";

const MAX_RESULTS = 8;
const FETCH_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

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

const _parseUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hostname = url.hostname.toLowerCase().replace(/^(?:www|m)\./, "");
    return url;
  } catch {
    return null;
  }
};

const _findLink = (results) => {
  if (!Array.isArray(results)) return null;
  for (const result of _ranked(results).slice(0, MAX_RESULTS)) {
    const url = _parseUrl(result?.url);
    const link = url && parseLink(url);
    if (link) return { ...link, title: String(result?.title || "") };
  }
  return null;
};

const _language = (locale) => (String(locale || "").toLowerCase().startsWith("ru") ? "ru" : "uk");

const _fetchForecast = async (url, fetchFn) => {
  const cached = cache ? await cache.get(url) : null;
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const forecast = parseForecast(await res.text());
    if (forecast && cache) await cache.set(url, forecast);
    return forecast;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const slot = {
  isClientExposed: false,
  id: "weather-card",
  name: "Weather card",
  description: "Shows a weather card when the results link to a city forecast on a weather site.",
  position: LAYOUT_POSITION[LAYOUT.PANEL],
  waitForResults: true,

  settingsSchema: [
    {
      key: "layout",
      label: "Layout",
      type: "select",
      options: [LAYOUT.PANEL, LAYOUT.FULL_WIDTH],
      optionLabels: ["Panel above results", "Full width above results"],
      default: LAYOUT.PANEL,
      description: "Where the card appears and how it is framed.",
    },
  ],

  configure(settings) {
    const layout = settings?.layout === LAYOUT.FULL_WIDTH ? LAYOUT.FULL_WIDTH : LAYOUT.PANEL;
    slot.position = LAYOUT_POSITION[layout];
  },

  init(ctx) {
    cache = typeof ctx?.useCache === "function" ? ctx.useCache("ext:weather-card:forecast", CACHE_TTL_MS) : null;
  },

  trigger() {
    return true;
  },

  async execute(query, context) {
    const link = _findLink(context?.results);
    if (!link) return { html: "" };
    const url = pageUrl(link.slug, _language(context?.locale));
    const forecast = await _fetchForecast(url, context?.fetch ?? fetch);
    if (!forecast) return { html: "" };
    const names = [link.title, link.slug.replace(/-/g, " "), forecast.title, forecast.titleIn];
    if (!matchesPlace(query, names)) return { html: "" };
    return { title: "", html: renderCard(buildView(forecast, context?.locale), url, SOURCE) };
  },
};

export default { slot };

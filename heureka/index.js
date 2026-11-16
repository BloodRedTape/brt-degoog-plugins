import { BASE, parseCanonical, parsePage } from "./parse.js";
import { DEFAULT_REGIONS, REGION_SETTINGS, parseRegions, regionAllowed } from "./regions.js";

const FALLBACK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const RESULTS_PER_PAGE = 10;
const SITE_PAGE_SIZE = 24;
const SEARCH_BASE = "search";

const _searchUrl = (query, sitePage) => {
  const params = new URLSearchParams({ "h[fraze]": query });
  if (sitePage > 1) params.set("f", String(sitePage));
  return `${BASE}/?${params}`;
};

const _baseFromCanonical = (canonical) => {
  try {
    const url = new URL(canonical, BASE);
    if (url.hostname.endsWith(".heureka.cz") && url.hostname !== "www.heureka.cz") {
      return `${url.origin}${url.pathname}`;
    }
  } catch {}
  return SEARCH_BASE;
};

const _pageUrl = (base, query, sitePage) => {
  if (base === SEARCH_BASE) return _searchUrl(query, sitePage);
  return sitePage > 1 ? `${base}?f=${sitePage}` : base;
};

const _headers = (context) => ({
  "User-Agent": context?.userAgent?.() || FALLBACK_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
});

export default class HeurekaEngine {
  isClientExposed = false;
  name = "Heureka.cz";
  bangShortcut = "heureka";
  settingsSchema = REGION_SETTINGS;
  allowedRegions = DEFAULT_REGIONS;
  runWithoutRegion = true;

  configure(settings) {
    if (settings?.allowedRegions !== undefined) {
      this.allowedRegions = parseRegions(settings.allowedRegions);
    }
    this.runWithoutRegion = settings?.runWithoutRegion !== "false" && settings?.runWithoutRegion !== false;
  }

  async _fetchHtml(url, context) {
    const doFetch = context?.fetch ?? fetch;
    const res = await doFetch(url, { headers: _headers(context), redirect: "follow" });
    context?.sentinel?.(res, this.name);
    if (!res.ok) return null;
    return res.text();
  }

  async _sitePage(query, base, sitePage, context, first) {
    if (sitePage === 1 && first) return first;
    const html = await this._fetchHtml(_pageUrl(base, query, sitePage), context);
    return html ? parsePage(html, this.name) : { results: [], total: 0 };
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!query.trim()) return [];
    if (!regionAllowed(context?.region, this.allowedRegions, this.runWithoutRegion)) return [];

    const start = (page - 1) * RESULTS_PER_PAGE;
    const end = start + RESULTS_PER_PAGE;
    const firstSitePage = Math.floor(start / SITE_PAGE_SIZE) + 1;
    const lastSitePage = Math.floor((end - 1) / SITE_PAGE_SIZE) + 1;

    let base = context?.carried?.heurekaBase;
    let total = Number(context?.carried?.heurekaTotal) || 0;
    let first = null;
    if (!base) {
      const html = await this._fetchHtml(_searchUrl(query, 1), context);
      if (!html) return [];
      first = parsePage(html, this.name);
      base = _baseFromCanonical(parseCanonical(html));
      total = first.total;
    }
    context?.carry?.({ heurekaBase: base, heurekaTotal: String(total) });
    if (total) context?.pagination?.({ total: Math.ceil(total / RESULTS_PER_PAGE) });

    const [a, b] = await Promise.all([
      this._sitePage(query, base, firstSitePage, context, first),
      lastSitePage !== firstSitePage
        ? this._sitePage(query, base, lastSitePage, context, first)
        : Promise.resolve({ results: [] }),
    ]);
    const seen = new Set(a.results.map((r) => r.url));
    const merged =
      a.results.length >= SITE_PAGE_SIZE ? a.results.concat(b.results.filter((r) => !seen.has(r.url))) : a.results;

    const offset = start - (firstSitePage - 1) * SITE_PAGE_SIZE;
    return merged.slice(offset, offset + RESULTS_PER_PAGE);
  }
}

export const type = "shop";
export const site = BASE;
export const regions = DEFAULT_REGIONS;

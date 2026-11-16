import { BASE, parseCanonical, parseResults } from "./parse.js";
import { DEFAULT_REGIONS, REGION_SETTINGS, parseRegions, regionAllowed } from "./regions.js";

const FALLBACK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const RESULTS_PER_PAGE = 10;
const SITE_PAGE_SIZE = 24;
const SEARCH_BASE = "search";
const CATEGORY_PAGE = /\/(\d+)\.htm$/;

const _searchUrl = (query, sitePage) => {
  const params = new URLSearchParams({ exps: query });
  const path = sitePage > 1 ? `search-p${sitePage}.htm` : "search.htm";
  return `${BASE}/${path}?${params}`;
};

const _baseFromCanonical = (canonical) => {
  try {
    const url = new URL(canonical, BASE);
    if (url.hostname.endsWith("alza.cz") && CATEGORY_PAGE.test(url.pathname)) {
      return `${url.origin}${url.pathname}`;
    }
  } catch {}
  return SEARCH_BASE;
};

const _pageUrl = (base, query, sitePage) => {
  if (base === SEARCH_BASE) return _searchUrl(query, sitePage);
  if (sitePage <= 1) return base;
  return base.replace(CATEGORY_PAGE, `/$1-p${sitePage}.htm`);
};

const _headers = (context) => ({
  "User-Agent": context?.userAgent?.() || FALLBACK_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
});

export default class AlzaEngine {
  isClientExposed = false;
  name = "Alza.cz";
  bangShortcut = "alza";
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

  async _sitePage(query, base, sitePage, context, firstHtml) {
    if (sitePage === 1 && firstHtml) return parseResults(firstHtml, this.name);
    const html = await this._fetchHtml(_pageUrl(base, query, sitePage), context);
    return html ? parseResults(html, this.name) : [];
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!query.trim()) return [];
    if (!regionAllowed(context?.region, this.allowedRegions, this.runWithoutRegion)) return [];

    const start = (page - 1) * RESULTS_PER_PAGE;
    const end = start + RESULTS_PER_PAGE;
    const firstSitePage = Math.floor(start / SITE_PAGE_SIZE) + 1;
    const lastSitePage = Math.floor((end - 1) / SITE_PAGE_SIZE) + 1;

    let base = context?.carried?.alzaBase;
    let firstHtml = null;
    if (!base) {
      firstHtml = await this._fetchHtml(_searchUrl(query, 1), context);
      if (!firstHtml) return [];
      base = _baseFromCanonical(parseCanonical(firstHtml));
    }
    context?.carry?.({ alzaBase: base });

    const [items, more] = await Promise.all([
      this._sitePage(query, base, firstSitePage, context, firstHtml),
      lastSitePage !== firstSitePage
        ? this._sitePage(query, base, lastSitePage, context, firstHtml)
        : Promise.resolve([]),
    ]);
    const seen = new Set(items.map((r) => r.url));
    const merged =
      items.length >= SITE_PAGE_SIZE ? items.concat(more.filter((r) => !seen.has(r.url))) : items;

    const offset = start - (firstSitePage - 1) * SITE_PAGE_SIZE;
    return merged.slice(offset, offset + RESULTS_PER_PAGE);
  }
}

export const type = "shop";
export const site = BASE;
export const regions = DEFAULT_REGIONS;

import { BASE, parsePage } from "./parse.js";
import { DEFAULT_REGIONS, REGION_SETTINGS, parseRegions, regionAllowed } from "./regions.js";

const FALLBACK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const RESULTS_PER_PAGE = 10;

const _searchUrl = (query) => `${BASE}/vyhledavani?${new URLSearchParams({ q: query })}`;

const _baseFromCanonical = (canonical, query) => {
  try {
    const url = new URL(canonical, BASE);
    if (url.hostname.endsWith("datart.cz")) {
      url.searchParams.delete("page");
      return url.toString();
    }
  } catch {}
  return _searchUrl(query);
};

const _pageUrl = (base, sitePage) => {
  if (sitePage <= 1) return base;
  const url = new URL(base);
  url.searchParams.set("page", String(sitePage));
  return url.toString();
};

const _headers = (context) => ({
  "User-Agent": context?.userAgent?.() || FALLBACK_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
});

export default class DatartEngine {
  isClientExposed = false;
  name = "Datart";
  bangShortcut = "datart";
  settingsSchema = REGION_SETTINGS;
  allowedRegions = DEFAULT_REGIONS;
  runWithoutRegion = true;

  configure(settings) {
    if (settings?.allowedRegions !== undefined) {
      this.allowedRegions = parseRegions(settings.allowedRegions);
    }
    this.runWithoutRegion = settings?.runWithoutRegion !== "false" && settings?.runWithoutRegion !== false;
  }

  async _fetchPage(url, context) {
    const doFetch = context?.fetch ?? fetch;
    const res = await doFetch(url, { headers: _headers(context), redirect: "follow" });
    context?.sentinel?.(res, this.name);
    if (!res.ok) return null;
    return parsePage(await res.text(), this.name);
  }

  async _resolve(query, context) {
    const carried = context?.carried;
    const size = Number(carried?.datartSize);
    if (carried?.datartBase && size > 0) {
      return { base: carried.datartBase, size, lastPage: Number(carried.datartLast) || 0 };
    }
    const first = await this._fetchPage(_searchUrl(query), context);
    if (!first) return null;
    return {
      base: _baseFromCanonical(first.canonical, query),
      size: first.results.length,
      lastPage: first.lastPage,
      first,
    };
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!query.trim()) return [];
    if (!regionAllowed(context?.region, this.allowedRegions, this.runWithoutRegion)) return [];

    const info = await this._resolve(query, context);
    if (!info || info.size === 0) return [];
    const { base, size, lastPage } = info;

    context?.carry?.({ datartBase: base, datartSize: String(size), datartLast: String(lastPage) });
    if (lastPage) context?.pagination?.({ total: Math.ceil((lastPage * size) / RESULTS_PER_PAGE) });

    const start = (page - 1) * RESULTS_PER_PAGE;
    const end = start + RESULTS_PER_PAGE;
    const firstSitePage = Math.floor(start / size) + 1;
    const lastSitePage = Math.floor((end - 1) / size) + 1;

    const load = async (sitePage) => {
      if (sitePage === 1 && info.first) return info.first.results;
      const parsed = await this._fetchPage(_pageUrl(base, sitePage), context);
      return parsed?.results ?? [];
    };

    let items = await load(firstSitePage);
    if (lastSitePage !== firstSitePage && items.length >= size) {
      const seen = new Set(items.map((r) => r.url));
      items = items.concat((await load(lastSitePage)).filter((r) => !seen.has(r.url)));
    }

    const offset = start - (firstSitePage - 1) * size;
    return items.slice(offset, offset + RESULTS_PER_PAGE);
  }
}

export const type = "shop";
export const site = BASE;
export const regions = DEFAULT_REGIONS;

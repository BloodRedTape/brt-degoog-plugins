import { parseResults } from "./parse.js";
import { DEFAULT_REGIONS, REGION_SETTINGS, parseRegions, regionAllowed } from "./regions.js";

const FALLBACK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const SITE_PAGE_SIZE = 29;
const RESULTS_PER_PAGE = 10;

const _langPrefix = (lang) => (lang?.toLowerCase().startsWith("ru") ? "" : "/ua");

const _buildUrl = (query, page, langPrefix) => {
  const params = new URLSearchParams({ search_term: query });
  if (page > 1) params.set("page", String(page));
  return `https://prom.ua${langPrefix}/search?${params}`;
};

const _buildHeaders = (context, langPrefix) => ({
  "User-Agent": context?.userAgent?.() || FALLBACK_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": langPrefix ? "uk-UA,uk;q=0.9,en;q=0.8" : "ru-UA,ru;q=0.9,uk;q=0.8",
});

export default class PromUaEngine {
  isClientExposed = false;
  name = "Prom.ua";
  bangShortcut = "prom";
  settingsSchema = REGION_SETTINGS;
  allowedRegions = DEFAULT_REGIONS;
  runWithoutRegion = true;

  configure(settings) {
    if (settings?.allowedRegions !== undefined) {
      this.allowedRegions = parseRegions(settings.allowedRegions);
    }
    this.runWithoutRegion = settings?.runWithoutRegion !== "false" && settings?.runWithoutRegion !== false;
  }

  async _fetchSitePage(query, sitePage, langPrefix, context) {
    const doFetch = context?.fetch ?? fetch;
    const res = await doFetch(_buildUrl(query, sitePage, langPrefix), {
      headers: _buildHeaders(context, langPrefix),
      redirect: "follow",
    });
    context?.sentinel?.(res, this.name);
    if (!res.ok) return null;
    return parseResults(await res.text(), this.name, langPrefix);
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!query.trim()) return [];
    if (!regionAllowed(context?.region, this.allowedRegions, this.runWithoutRegion)) return [];
    const langPrefix = _langPrefix(context?.lang);
    const start = (page - 1) * RESULTS_PER_PAGE;
    const end = start + RESULTS_PER_PAGE;
    const firstSitePage = Math.floor(start / SITE_PAGE_SIZE) + 1;
    const lastSitePage = Math.floor((end - 1) / SITE_PAGE_SIZE) + 1;

    const first = await this._fetchSitePage(query, firstSitePage, langPrefix, context);
    if (!first) return [];
    if (first.total) {
      context?.pagination?.({ total: Math.ceil(first.total / RESULTS_PER_PAGE) });
    }

    let items = first.results;
    if (lastSitePage !== firstSitePage && items.length >= SITE_PAGE_SIZE) {
      const second = await this._fetchSitePage(query, lastSitePage, langPrefix, context);
      if (second) {
        const seen = new Set(items.map((r) => r.url));
        items = items.concat(second.results.filter((r) => !seen.has(r.url)));
      }
    }

    const offset = start - (firstSitePage - 1) * SITE_PAGE_SIZE;
    return items.slice(offset, offset + RESULTS_PER_PAGE);
  }
}

export const type = "shop";
export const site = "https://prom.ua";
export const regions = DEFAULT_REGIONS;

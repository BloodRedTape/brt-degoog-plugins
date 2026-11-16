import { parseJsonBody, parseSearch, parseDetails } from "./parse.js";
import { DEFAULT_REGIONS, REGION_SETTINGS, parseRegions, regionAllowed } from "./regions.js";

const FALLBACK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const RESULTS_PER_PAGE = 10;
const SITE_PAGE_SIZE = 60;

const _lang = (lang) => (lang?.toLowerCase().startsWith("ru") ? "ru" : "ua");

const _searchUrl = (query, sitePage, lang) => {
  const params = new URLSearchParams({
    "front-type": "xl",
    country: "UA",
    lang,
    redirected: "1",
    text: query,
  });
  if (sitePage > 1) params.set("page", String(sitePage));
  const prefix = lang === "ru" ? "" : "/ua";
  return `https://search.rozetka.com.ua${prefix}/search/api/v6/?${params}`;
};

const _detailsUrl = (ids, lang) => {
  const params = new URLSearchParams({ country: "UA", lang, ids: ids.join(",") });
  return `https://common-api.rozetka.com.ua/v1/api/product/details?${params}`;
};

const _headers = (context, lang) => ({
  "User-Agent": context?.userAgent?.() || FALLBACK_UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": lang === "ru" ? "ru-UA,ru;q=0.9,uk;q=0.8" : "uk-UA,uk;q=0.9,en;q=0.8",
  Origin: "https://rozetka.com.ua",
  Referer: "https://rozetka.com.ua/",
});

export default class RozetkaEngine {
  isClientExposed = false;
  name = "Rozetka";
  bangShortcut = "rozetka";
  settingsSchema = REGION_SETTINGS;
  allowedRegions = DEFAULT_REGIONS;
  runWithoutRegion = true;

  configure(settings) {
    if (settings?.allowedRegions !== undefined) {
      this.allowedRegions = parseRegions(settings.allowedRegions);
    }
    this.runWithoutRegion = settings?.runWithoutRegion !== "false" && settings?.runWithoutRegion !== false;
  }

  async _getJson(url, context, lang) {
    const doFetch = context?.fetch ?? fetch;
    const res = await doFetch(url, { headers: _headers(context, lang), redirect: "follow" });
    context?.sentinel?.(res, this.name);
    if (!res.ok) return null;
    try {
      return parseJsonBody(await res.text());
    } catch {
      return null;
    }
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!query.trim()) return [];
    if (!regionAllowed(context?.region, this.allowedRegions, this.runWithoutRegion)) return [];
    const lang = _lang(context?.lang);
    const start = (page - 1) * RESULTS_PER_PAGE;
    const sitePage = Math.floor(start / SITE_PAGE_SIZE) + 1;

    const search = await this._getJson(_searchUrl(query, sitePage, lang), context, lang);
    if (!search) return [];
    const { ids, found } = parseSearch(search);
    if (found) context?.pagination?.({ total: Math.ceil(found / RESULTS_PER_PAGE) });

    const offset = start % SITE_PAGE_SIZE;
    const pageIds = ids.slice(offset, offset + RESULTS_PER_PAGE);
    if (pageIds.length === 0) return [];

    const details = await this._getJson(_detailsUrl(pageIds, lang), context, lang);
    if (!details) return [];
    return parseDetails(details, pageIds, this.name);
  }
}

export const type = "shop";
export const site = "https://rozetka.com.ua";
export const regions = DEFAULT_REGIONS;

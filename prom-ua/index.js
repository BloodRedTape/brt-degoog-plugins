import { parseResults } from "./parse.js";

const FALLBACK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const PAGE_SIZE = 29;

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

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!query.trim()) return [];
    const langPrefix = _langPrefix(context?.lang);
    const doFetch = context?.fetch ?? fetch;
    const res = await doFetch(_buildUrl(query, page, langPrefix), {
      headers: _buildHeaders(context, langPrefix),
      redirect: "follow",
    });
    context?.sentinel?.(res, this.name);
    if (!res.ok) return [];

    const { results, total } = parseResults(await res.text(), this.name, langPrefix);
    if (total) context?.pagination?.({ total: Math.ceil(total / PAGE_SIZE) });
    return results;
  }
}

export const type = "shop";

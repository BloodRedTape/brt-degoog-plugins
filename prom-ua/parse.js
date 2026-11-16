import * as cheerio from "cheerio";

const BASE = "https://prom.ua";
const STATE_MARKER = "window.ApolloCacheState";

const _sliceJsonObject = (text, from) => {
  const start = text.indexOf("{", from);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
};

const _readState = (html) => {
  const at = html.indexOf(STATE_MARKER);
  if (at < 0) return null;
  const json = _sliceJsonObject(html, at + STATE_MARKER.length);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const _findListing = (state) => {
  const cache = state?._FAST_CACHE ?? state;
  if (!cache || typeof cache !== "object") return null;
  const key = Object.keys(cache).find((k) => k.startsWith("SearchListingQuery"));
  return key ? cache[key] : null;
};

const _collectProductItems = (node, out) => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) _collectProductItems(item, out);
    return;
  }
  if (node.__typename === "ProductItem" && node.product) {
    out.push(node);
    return;
  }
  for (const value of Object.values(node)) _collectProductItems(value, out);
};

const _findTotal = (node, depth = 0) => {
  if (!node || typeof node !== "object" || depth > 6) return undefined;
  if (typeof node.page?.total === "number") return node.page.total;
  for (const value of Object.values(node)) {
    const total = _findTotal(value, depth + 1);
    if (total !== undefined) return total;
  }
  return undefined;
};

const _formatPrice = (raw, currency) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return "";
  const formatted = new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${currency || "₴"}`;
};

const _priceText = (p) => {
  if (!p.canShowPrice) return p.noPriceText || "";
  const currency = p.priceCurrencyLocalized;
  const from = p.priceFrom ? "від " : "";
  const hasDiscount =
    p.hasDiscount && p.discountedPrice && Number(p.discountedPrice) < Number(p.price);
  if (hasDiscount) {
    return `${from}${_formatPrice(p.discountedPrice, currency)} (було ${_formatPrice(p.price, currency)})`;
  }
  return `${from}${_formatPrice(p.price, currency)}`;
};

const _presenceText = (presence) => {
  if (!presence) return "";
  if (presence.isAvailable) return presence.isEnding ? "Закінчується" : "В наявності";
  if (presence.isOrderable) return "Під замовлення";
  if (presence.isWait) return "Очікується";
  return "Немає в наявності";
};

const _productUrl = (item, langPrefix) => {
  const p = item.product;
  const model = p.model;
  if (item.shouldShowAsModel && model?.enabled && model.id && model.urlText) {
    return `${BASE}${langPrefix}/m${model.id}-${model.urlText}.html?p=${p.id}`;
  }
  return `${BASE}${langPrefix}/p${p.id}-${p.urlText || "product"}.html`;
};

const _toResult = (item, name, langPrefix) => {
  const p = item.product;
  if (!p?.id || !p.name) return null;
  const parts = [
    _priceText(p),
    _presenceText(p.presence),
    [p.company?.name, p.company?.regionName].filter(Boolean).join(", "),
  ].filter(Boolean);
  const thumbnail = p.image400x400 || p.image640 || p.image || "";
  return {
    title: p.name,
    url: _productUrl(item, langPrefix),
    snippet: parts.join(" · "),
    source: name,
    ...(thumbnail ? { thumbnail } : {}),
  };
};

const _parseHtmlFallback = (html, name) => {
  const $ = cheerio.load(html);
  const results = [];
  $('[data-qaid="product_block"]').each((_, el) => {
    const $el = $(el);
    const href = $el.find('[data-qaid="product_link"]').first().attr("href") || "";
    const title =
      $el.find('[data-qaid="product_name"]').first().text().trim() ||
      $el.find('[data-qaid="product_link"]').first().attr("title") ||
      "";
    if (!href || !title) return;
    const parts = [
      $el.find('[data-qaid="product_price"]').first().text().replace(/\s+/g, " ").trim(),
      $el.find('[data-qaid="product_presence"]').first().text().trim(),
      $el.find('[data-qaid="company_link"]').first().text().trim(),
    ].filter(Boolean);
    const img = $el.find("img").first();
    const thumbnail = img.attr("src") || img.attr("data-src") || "";
    results.push({
      title,
      url: new URL(href, BASE).toString(),
      snippet: parts.join(" · "),
      source: name,
      ...(thumbnail.startsWith("http") ? { thumbnail } : {}),
    });
  });
  return results;
};

export const parseResults = (html, name, langPrefix) => {
  const state = _readState(html);
  if (state) {
    const listing = _findListing(state) ?? state;
    const items = [];
    _collectProductItems(listing, items);
    const seen = new Set();
    const results = [];
    for (const item of items) {
      const id = item.product?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const result = _toResult(item, name, langPrefix);
      if (result) results.push(result);
    }
    if (results.length > 0) {
      return { results, total: _findTotal(listing) };
    }
  }
  return { results: _parseHtmlFallback(html, name) };
};

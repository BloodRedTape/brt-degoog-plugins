export const BASE = "https://www.heureka.cz";

const STATE_RE = /<script[^>]*id="category-search-state"[^>]*>([\s\S]*?)<\/script>/;
const CANONICAL_RE = /<link[^>]*rel="canonical"[^>]*href="([^"]+)"|<link[^>]*href="([^"]+)"[^>]*rel="canonical"/;

const _readState = (html) => {
  const m = html.match(STATE_RE);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
};

const _findListing = (state) => {
  const queries = state?.oneRequestGetAllApi?.queries ?? {};
  for (const entry of Object.values(queries)) {
    const items = entry?.data?.items;
    if (Array.isArray(items?.result)) return items;
  }
  return null;
};

const _money = (value, currency) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
};

const _priceRange = (min, max, currency) => {
  const lo = _money(min, currency);
  const hi = _money(max, currency);
  if (!lo) return hi;
  if (!hi || Number(min) === Number(max)) return lo;
  return `${lo.replace(/\s*[^\d\s,.]+$/, "")} – ${hi}`;
};

const _shops = (count) => {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n === 1 ? "v 1 obchodě" : `v ${n} obchodech`;
};

const _rating = (rating, count) => {
  if (rating === null || rating === undefined) return "";
  return `★ ${rating} %${count ? ` (${count})` : ""}`;
};

const _thumbnail = (item) => item?.images?.["400x400"]?.url || item?.images?.["200x200"]?.url || "";

const _productResult = (item, currency, origin) => {
  if (!item.slug || !item.categorySlug) return null;
  const host = new URL(origin).hostname.replace(/^www\./, "");
  return {
    title: item.name,
    url: `https://${item.categorySlug}.${host}/${item.slug}/`,
    snippet: [
      _priceRange(item.minPrice, item.maxPrice, currency),
      _shops(item.shopCount),
      _rating(item.reviewRating, item.reviewCount),
    ]
      .filter(Boolean)
      .join(" · "),
  };
};

const _offerResult = (item, currency, origin) => {
  const exit = item.preferredExit;
  if (!exit?.url) return null;
  return {
    title: item.name,
    url: new URL(exit.url, origin).toString(),
    snippet: [_money(item.price, currency), exit.shopName].filter(Boolean).join(" · "),
  };
};

export const parseCanonical = (html) => {
  const m = html.match(CANONICAL_RE);
  return m ? m[1] || m[2] : "";
};

export const parsePage = (html, name, origin = BASE) => {
  const state = _readState(html);
  const listing = _findListing(state);
  if (!listing) return { results: [], total: 0 };

  const currency = state?.country?.currencyCode || "CZK";
  const results = [];
  const seen = new Set();
  for (const item of listing.result) {
    if (!item?.name) continue;
    const base =
      item.type === "offer" ? _offerResult(item, currency, origin) : _productResult(item, currency, origin);
    if (!base || seen.has(base.url)) continue;
    seen.add(base.url);
    const thumbnail = _thumbnail(item);
    results.push({ ...base, source: name, ...(thumbnail ? { thumbnail } : {}) });
  }

  return { results, total: Number(listing.total?.value) || 0 };
};

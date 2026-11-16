import * as cheerio from "cheerio";

export const BASE = "https://www.datart.cz";

const _clean = (text) => text.replace(/\s+/g, " ").trim();

const _formatPrice = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(n)} Kč`;
};

const _readGtm = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const _lastPage = ($) => {
  let max = 1;
  $('.pagination a[href*="page="]').each((_, el) => {
    const m = ($(el).attr("href") || "").match(/[?&]page=(\d+)/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return max;
};

export const parsePage = (html, name) => {
  const $ = cheerio.load(html);
  const results = [];
  const seen = new Set();

  $(".product-box-list .product-box[data-gtm-data-product]").each((_, el) => {
    const $el = $(el);
    const data = _readGtm($el.attr("data-gtm-data-product") || "");
    const $link = $el.find(".product-box-part-title a[href]").first();
    const href = $link.attr("href") || $el.find("a.product-box-link-box").attr("href") || "";
    const title = data?.item_name || $link.attr("title") || _clean($link.text());
    if (!href || !title) return;

    const url = new URL(href, BASE).toString();
    if (seen.has(url)) return;
    seen.add(url);

    const price = _formatPrice(data?.price);
    const $strike = $el.find(".cut-price--strike").first().clone();
    $strike.find(".sr-only").remove();
    const oldPrice = _clean($strike.text());
    const rating = _clean($el.find(".product-box-part-rating .bold").first().text());
    const ratingCount = _clean($el.find(".product-box-part-rating .text-underline").first().text());

    const parts = [
      price && oldPrice && oldPrice !== price ? `${price} (bylo ${oldPrice})` : price,
      data?.item_availability_state || "",
      rating ? `★ ${rating}${ratingCount ? ` (${ratingCount})` : ""}` : "",
    ].filter(Boolean);

    const thumbnail = $el.find(".product-box-part-image img").first().attr("src") || "";

    results.push({
      title,
      url,
      snippet: parts.join(" · "),
      source: name,
      ...(thumbnail.startsWith("http") ? { thumbnail } : {}),
    });
  });

  return {
    results,
    canonical: $('link[rel="canonical"]').attr("href") || "",
    lastPage: _lastPage($),
  };
};

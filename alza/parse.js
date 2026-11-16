import * as cheerio from "cheerio";

export const BASE = "https://www.alza.cz";

const _clean = (text) => text.replace(/\s+/g, " ").trim();

const _spacedText = ($, $node) =>
  _clean(
    $node
      .find("*")
      .addBack()
      .contents()
      .toArray()
      .filter((n) => n.type === "text")
      .map((n) => $(n).text())
      .join(" "),
  );

const _price = (text) => {
  const value = _clean(text).replace(/,-$/, "").trim();
  return value ? `${value} Kč` : "";
};

export const parseCanonical = (html) => {
  const $ = cheerio.load(html);
  return $('link[rel="canonical"]').attr("href") || "";
};

export const parseResults = (html, name) => {
  const $ = cheerio.load(html);
  const results = [];
  const seen = new Set();

  $(".browsingitem[data-id]").each((_, el) => {
    const $el = $(el);
    const $link = $el.find("a.name.browsinglink").first();
    const href = $link.attr("href") || "";
    const title = _clean($link.text());
    if (!href || !title) return;

    const url = new URL(href, BASE).toString();
    if (seen.has(url)) return;
    seen.add(url);

    const price = _price($el.find(".js-price-box__primary-price__value").first().text());
    const oldPrice = _price($el.find(".js-compare-price").first().text());
    const availability = _spacedText($, $el.find(".avlVal").first());
    const ratingValue = _clean($el.find(".star-rating-block__value").first().text());
    const ratingCount = _clean($el.find(".star-rating-block__count").first().text()).replace(/×$/, "");

    const parts = [
      oldPrice && oldPrice !== price ? `${price} (bylo ${oldPrice})` : price,
      availability,
      ratingValue ? `★ ${ratingValue}${ratingCount ? ` (${ratingCount})` : ""}` : "",
    ].filter(Boolean);

    const thumbnail = $el.find("img.js-box-image").first().attr("src") || "";

    results.push({
      title,
      url,
      snippet: parts.join(" · "),
      source: name,
      ...(thumbnail.startsWith("http") ? { thumbnail } : {}),
    });
  });

  return results;
};

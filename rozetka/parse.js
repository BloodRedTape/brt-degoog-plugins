const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

const _decodeEntities = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });

export const parseJsonBody = (body) => {
  const text = body.trim();
  if (text.startsWith("{") || text.startsWith("[")) return JSON.parse(text);
  const pre = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  const inner = pre ? pre[1] : text.replace(/<[^>]*>/g, "");
  return JSON.parse(_decodeEntities(inner).trim());
};

export const parseSearch = (json) => {
  const data = json?.data ?? {};
  const ids = (data.goods ?? []).map((g) => g?.id).filter((id) => Number.isFinite(id));
  return { ids, found: data.quantities?.goods_quantity_found };
};

const _formatPrice = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(n)} ₴`;
};

const SELL_STATUS = {
  available: "Є в наявності",
  limited: "Закінчується",
  call_to_order: "Під замовлення",
  waiting_for_supply: "Очікується постачання",
  out_of_stock: "Немає в наявності",
  unavailable: "Немає в наявності",
  archive: "Знятий з виробництва",
};

const _priceText = (p) => {
  if (p.hide_price) return "";
  const price = _formatPrice(p.price);
  const old = Number(p.old_price) > Number(p.price) ? _formatPrice(p.old_price) : "";
  return old ? `${price} (було ${old})` : price;
};

const _thumbnail = (p) => {
  const main = p.images?.main || p.images?.all?.[0] || "";
  return main.replace("/goods/images/original/", "/goods/images/big_tile/");
};

export const parseDetails = (json, ids, name) => {
  const byId = new Map((json?.data ?? []).map((p) => [p.id, p]));
  const results = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (!p?.title || !p.href) continue;
    const rating =
      p.comments_amount > 0 && p.comments_mark > 0
        ? `★ ${Number(p.comments_mark).toFixed(1)} (${p.comments_amount})`
        : "";
    const parts = [
      _priceText(p),
      SELL_STATUS[p.sell_status] ?? "",
      p.seller?.title && p.seller.title !== "Rozetka" ? p.seller.title : "",
      rating,
    ].filter(Boolean);
    const thumbnail = _thumbnail(p);
    results.push({
      title: p.title,
      url: p.href,
      snippet: parts.join(" · "),
      source: name,
      ...(thumbnail ? { thumbnail } : {}),
    });
  }
  return results;
};

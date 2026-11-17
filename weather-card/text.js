const STOPWORDS = new Set([
  "weather", "forecast", "today", "tomorrow", "week", "days", "in", "for", "the", "at",
  "погода", "погоди", "погоду", "прогноз", "прогнозу", "сегодня", "сьогодні", "завтра",
  "неделю", "неделя", "тиждень", "дней", "днів", "на", "в", "у", "во", "для",
  "pohoda", "sinoptik", "синоптик",
]);

const MIN_COVERAGE = 0.6;

export const cleanText = (value) =>
  String(value || "")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const _norm = (value) =>
  cleanText(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const _tokens = (value) => _norm(value).split(" ").filter(Boolean);

const _tokenMatch = (a, b) => {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false;
  let common = 0;
  while (common < shorter && a[common] === b[common]) common += 1;
  return common >= Math.max(4, shorter - 2);
};

export const matchesPlace = (query, names) => {
  const wanted = _tokens(query).filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t));
  if (!wanted.length) return true;
  const known = names.flatMap(_tokens);
  const covered = wanted.filter((t) => known.some((k) => _tokenMatch(t, k))).length;
  return covered / wanted.length >= MIN_COVERAGE;
};

export const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

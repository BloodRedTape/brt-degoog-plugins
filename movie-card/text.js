const STOPWORDS = new Set([
  "film", "films", "movie", "movies", "series", "tv", "show", "watch", "online", "trailer", "imdb",
  "cast", "review", "reviews", "season", "seasons", "episode", "episodes", "full", "hd", "free",
  "фильм", "фильмы", "кино", "сериал", "сериалы", "смотреть", "онлайн", "трейлер", "актеры", "актёры",
  "отзывы", "сезон", "сезоны", "серия", "серии", "бесплатно",
  "фільм", "фільми", "серіал", "серіали", "дивитися", "дивитись", "актори", "відгуки", "серія", "безкоштовно",
]);

const MIN_COVERAGE = 0.6;

const _norm = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const _tokens = (value) => _norm(value).split(" ").filter(Boolean);

const _queryTokens = (query) => {
  const all = _tokens(query);
  const meaningful = all.filter((t) => !STOPWORDS.has(t));
  return meaningful.length ? meaningful : all;
};

const _tokenMatch = (a, b) => {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false;
  let common = 0;
  while (common < shorter && a[common] === b[common]) common += 1;
  return common >= Math.max(4, shorter - 2);
};

const _hits = (token, list) => list.some((t) => _tokenMatch(token, t));

export const matchesQuery = (query, names, extras) => {
  const queryList = _queryTokens(query);
  const nameList = names.flatMap(_tokens);
  if (!queryList.length || !nameList.length) return false;
  if (!queryList.some((t) => _hits(t, nameList))) return false;
  const known = [...nameList, ...extras.flatMap(_tokens)];
  const covered = queryList.filter((t) => _hits(t, known)).length;
  return covered / queryList.length >= MIN_COVERAGE;
};

export const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

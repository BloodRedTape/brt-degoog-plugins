const STOPWORDS = new Set([
  "song", "songs", "track", "tracks", "album", "albums", "artist", "lyrics",
  "listen", "music", "official", "video", "audio", "online", "discography",
  "песня", "песни", "песню", "трек", "треки", "альбом", "альбомы", "текст",
  "слушать", "музыка", "клип", "онлайн", "дискография", "исполнитель",
  "пісня", "пісні", "слухати", "музика", "кліп",
]);

const MIN_COVERAGE = 0.6;

const VERSION_SUFFIX =
  /\s*[([](?:feat\.?|ft\.?|with|prod\.?|remaster(?:ed)?|\d{4}\s+remaster(?:ed)?|version|edit|mix|live|mono|stereo|deluxe|bonus|explicit)[^)\]]*[)\]]/gi;
const VERSION_TAIL = /\s+[-–—]\s+(?:\d{4}\s+)?(?:remaster(?:ed)?|radio edit|single version|live|mono|stereo)\b.*$/i;

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

export const matchesQuery = (query, name, artist) => {
  const queryList = _queryTokens(query);
  const nameList = _tokens(name);
  if (!queryList.length || !nameList.length) return false;
  if (!queryList.some((t) => _hits(t, nameList))) return false;
  const known = [...nameList, ..._tokens(artist)];
  const covered = queryList.filter((t) => _hits(t, known)).length;
  return covered / queryList.length >= MIN_COVERAGE;
};

const _baseName = (value) => _norm(cleanText(value).replace(VERSION_SUFFIX, "").replace(VERSION_TAIL, ""));

export const sameName = (a, b) => {
  const left = _baseName(a);
  return Boolean(left) && left === _baseName(b);
};

export const looseArtist = (a, b) => {
  const left = _norm(a);
  const right = _norm(b);
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const rightTokens = right.split(" ");
  return left.split(" ").some((t) => t.length > 2 && _hits(t, rightTokens));
};

export const dropTransliteration = (value) => {
  const text = cleanText(value);
  return /\p{Script=Cyrillic}/u.test(text) ? text.replace(/\s*\([\x20-\x7E]*\)/g, "").trim() : text;
};

export const splitDash = (value) => {
  const match = cleanText(value).match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return match ? [match[1].trim(), match[2].trim()] : null;
};

export const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

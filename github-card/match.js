const STOPWORDS = new Set([
  "github", "gh", "git", "repo", "repository", "repositories", "source", "code", "open", "the", "of",
  "гитхаб", "гітхаб", "гит", "репо", "репозиторий", "репозиторій", "исходники", "код",
]);

const MIN_PREFIX = 4;
const MIN_CONTAINED = 4;

const _compact = (value) =>
  String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

const _words = (query) =>
  String(query || "")
    .normalize("NFKD")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

export const queryMatcher = (query) => {
  const words = _words(query);
  const tokens = words.filter((word) => !STOPWORDS.has(word));
  const joined = words.join("");
  return (name) => {
    const compact = _compact(name);
    if (!compact) return false;
    if (compact.length >= MIN_CONTAINED && joined.includes(compact)) return true;
    return tokens.some(
      (token) =>
        token === compact ||
        (token.length >= MIN_PREFIX && compact.length >= MIN_PREFIX && (compact.startsWith(token) || token.startsWith(compact))),
    );
  };
};

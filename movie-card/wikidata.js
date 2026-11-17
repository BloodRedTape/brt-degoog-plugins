const SPARQL = "https://query.wikidata.org/sparql";
const WIKIPEDIA_HOST_RE = /^[a-z-]+\.wikipedia\.org$/;
const LANG_RE = /^[a-z]{2,3}$/;
const IMDB_ID_RE = /^tt\d{7,10}$/;

const _query = (imdbId, lang) => `SELECT ?label ?enLabel ?title ?article ?enArticle ?names
  (MIN(?date) AS ?released) (MIN(?start) AS ?started) (MAX(?end) AS ?ended)
  (MIN(?minutes) AS ?duration) (MAX(?seasonCount) AS ?seasons) (MAX(?tv) AS ?series)
  (GROUP_CONCAT(DISTINCT ?directorName; separator="|") AS ?directors)
  (GROUP_CONCAT(DISTINCT ?creatorName; separator="|") AS ?creators)
WHERE {
  ?item wdt:P345 "${imdbId}" .
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "${lang}") }
  OPTIONAL { ?item rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
  OPTIONAL { ?item wdt:P1476 ?title }
  OPTIONAL { ?item wdt:P577 ?date }
  OPTIONAL { ?item wdt:P580 ?start }
  OPTIONAL { ?item wdt:P582 ?end }
  OPTIONAL { ?item wdt:P2047 ?minutes }
  OPTIONAL { ?item wdt:P2437 ?seasonCount }
  OPTIONAL { ?item wdt:P57 ?director . ?director rdfs:label ?directorName FILTER(LANG(?directorName) = "${lang}") }
  OPTIONAL { ?item wdt:P170 ?creator . ?creator rdfs:label ?creatorName FILTER(LANG(?creatorName) = "${lang}") }
  BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q15416 } AS ?tv)
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://${lang}.wikipedia.org/> }
  OPTIONAL { ?enArticle schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL {
    SELECT (GROUP_CONCAT(DISTINCT ?name; separator="|") AS ?names)
    WHERE { ?named wdt:P345 "${imdbId}" ; rdfs:label|skos:altLabel ?name }
  }
}
GROUP BY ?label ?enLabel ?title ?article ?enArticle ?names
LIMIT 1`;

export const languageOf = (locale) => {
  const lang = String(locale || "").toLowerCase().split(/[-_]/)[0];
  return LANG_RE.test(lang) ? lang : "en";
};

const _value = (row, key) => row?.[key]?.value || "";

const _list = (row, key) => _value(row, key).split("|").map((s) => s.trim()).filter(Boolean);

const _number = (row, key) => {
  const value = Number(_value(row, key));
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const fetchFilm = async (imdbId, lang, fetchJson) => {
  if (!IMDB_ID_RE.test(imdbId) || !LANG_RE.test(lang)) return null;
  const url = `${SPARQL}?${new URLSearchParams({ query: _query(imdbId, lang), format: "json" })}`;
  const data = await fetchJson(url, "application/sparql-results+json");
  const row = data?.results?.bindings?.[0];
  if (!row) return null;
  return {
    label: _value(row, "label"),
    enLabel: _value(row, "enLabel"),
    title: _value(row, "title"),
    names: _list(row, "names"),
    released: _value(row, "released"),
    started: _value(row, "started"),
    ended: _value(row, "ended"),
    duration: _number(row, "duration"),
    seasons: _number(row, "seasons"),
    series: _value(row, "series") === "true",
    directors: _list(row, "directors"),
    creators: _list(row, "creators"),
    article: _value(row, "article") || _value(row, "enArticle"),
  };
};

export const fetchSummary = async (articleUrl, fetchJson) => {
  let url;
  try {
    url = new URL(articleUrl);
  } catch {
    return null;
  }
  const match = /^\/wiki\/([^/]+)$/.exec(url.pathname);
  if (url.protocol !== "https:" || !WIKIPEDIA_HOST_RE.test(url.hostname) || !match) return null;
  const data = await fetchJson(`https://${url.hostname}/api/rest_v1/page/summary/${match[1]}`, "application/json");
  if (!data) return null;
  const image = data.thumbnail?.source || "";
  return {
    url: data.content_urls?.desktop?.page || articleUrl,
    extract: String(data.extract || "").trim(),
    image: /^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(image) ? image : "",
  };
};

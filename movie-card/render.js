import { esc } from "./text.js";

const NS = "movie-card-slot";
const MAX_PEOPLE = 3;

const _t = (key) => `{{ t:${NS}.${key} }}`;

const _external = (url) => `href="${esc(url)}" target="_blank" rel="noopener noreferrer"`;

const _year = (iso) => (/^\d{4}/.test(iso) ? iso.slice(0, 4) : "");

const _years = (film) => {
  if (!film.series) return _year(film.released);
  const start = _year(film.started) || _year(film.released);
  if (!start) return "";
  const end = _year(film.ended);
  return end && end !== start ? `${start}–${end}` : end ? start : `${start}–`;
};

const _date = (iso, lang) => {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(time);
  } catch {
    return iso.slice(0, 10);
  }
};

const _duration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  const parts = [];
  if (hours) parts.push(`${hours} ${_t("unit.hour")}`);
  if (rest || !hours) parts.push(`${rest} ${_t("unit.minute")}`);
  return parts.join(" ");
};

const _same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

const _people = (list) => list.slice(0, MAX_PEOPLE).join(", ");

const _facts = (film, lang) => {
  const facts = [];
  if (film.series) {
    const people = film.creators.length ? film.creators : film.directors.length <= MAX_PEOPLE ? film.directors : [];
    if (people.length) facts.push(["creator", esc(_people(people))]);
    if (film.seasons) facts.push(["seasons", esc(film.seasons)]);
  } else {
    if (film.directors.length) facts.push(["director", esc(_people(film.directors))]);
    if (film.duration) facts.push(["duration", _duration(film.duration)]);
    if (film.released) facts.push(["released", esc(_date(film.released, lang))]);
  }
  return facts.length
    ? `<dl class="mv-facts">${facts
        .map(([key, value]) => `<div class="mv-fact"><dt class="degoog-text degoog-text--sm degoog-text--secondary">${_t(`fact.${key}`)}</dt><dd class="degoog-text">${value}</dd></div>`)
        .join("")}</dl>`
    : "";
};

const _links = (film) => {
  const links = [{ id: "imdb", label: "IMDb", icon: "fa-brands fa-imdb", url: `https://www.imdb.com/title/${film.imdbId}/` }];
  if (film.summary?.url) links.push({ id: "wikipedia", label: _t("wikipedia"), icon: "fa-brands fa-wikipedia-w", url: film.summary.url });
  return `<div class="mv-links">${links
    .map((l) => `<a class="degoog-btn degoog-btn--sm mv-link mv-link--${l.id}" ${_external(l.url)}><i class="${l.icon}" aria-hidden="true"></i>${l.label}</a>`)
    .join("")}</div>`;
};

export const renderCard = (film, lang) => {
  const name = film.label || film.enLabel || film.title;
  const original = film.title && !_same(film.title, name) ? film.title : "";
  const years = _years(film);
  const url = `https://www.imdb.com/title/${film.imdbId}/`;
  const icon = `<i class="fa-solid ${film.series ? "fa-tv" : "fa-film"}" aria-hidden="true"></i>`;
  return `<div class="mv-card">
  <a class="mv-poster" ${_external(url)} tabindex="-1" aria-hidden="true">${icon}${film.image ? `<img src="${esc(film.image)}" alt="" decoding="async">` : ""}</a>
  <div class="mv-main">
    <div class="mv-head">
      <span class="degoog-text degoog-text--sm degoog-text--secondary mv-kicker">${_t(film.series ? "kind.series" : "kind.film")}${years ? ` · ${esc(years)}` : ""}</span>
      <a class="mv-title" ${_external(url)}>${esc(name)}</a>
      ${original ? `<span class="degoog-text degoog-text--secondary">${esc(original)}</span>` : ""}
    </div>
    ${film.summary?.extract ? `<p class="degoog-text mv-extract">${esc(film.summary.extract)}</p>` : ""}
    ${_facts(film, lang)}
    ${_links(film)}
  </div>
</div>`;
};

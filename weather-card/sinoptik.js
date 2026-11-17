const HOST = "sinoptik.ua";
const STATE_RE = /<script[^>]*id="preloaded-state"[^>]*>([\s\S]*?)<\/script>/;
const LINK_RE = /^\/(?:(?:ru|uk|en)\/)?pohoda\/([a-z0-9-]+)(?:\/|$)/i;

export const SOURCE = {
  id: "sinoptik",
  label: "Sinoptik",
  icon: "fa-solid fa-cloud-sun",
};

const _number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const parseLink = (url) => {
  if (url.hostname !== HOST) return null;
  const match = url.pathname.match(LINK_RE);
  return match ? { slug: match[1].toLowerCase() } : null;
};

export const pageUrl = (slug, lang) =>
  lang === "ru" ? `https://${HOST}/ru/pohoda/${slug}` : `https://${HOST}/pohoda/${slug}`;

const _hour = (raw) => ({
  hour: _number(raw?.hour),
  temp: _number(raw?.temperature),
  feel: _number(raw?.temperatureFeel),
  cond: _number(raw?.condition) ?? 0,
  precip: _number(raw?.precipitation),
  humidity: _number(raw?.humidity),
  wind: _number(raw?.wind?.speed),
  windDir: typeof raw?.wind?.direction === "string" ? raw.wind.direction : "",
});

const _day = (raw) => ({
  date: String(raw?.date || ""),
  cond: _number(raw?.condition) ?? 0,
  min: _number(raw?.temperature?.min),
  max: _number(raw?.temperature?.max),
  now: raw?.now
    ? { temp: _number(raw.now.temperature), feel: _number(raw.now.temperatureFeel), cond: _number(raw.now.condition) }
    : null,
  hours: (Array.isArray(raw?.hours) ? raw.hours : [])
    .map(_hour)
    .filter((h) => h.hour !== null && h.hour >= 0 && h.hour < 24)
    .sort((a, b) => a.hour - b.hour),
});

export const parseForecast = (html) => {
  const raw = String(html || "").match(STATE_RE)?.[1];
  if (!raw) return null;
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    return null;
  }
  const data = state?.weather?.data;
  const location = data?.location;
  const days = (Array.isArray(data?.forecast) ? data.forecast : []).map(_day).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));
  if (!location || !days.length) return null;
  return {
    title: String(location.title || ""),
    titleIn: String(location.titleLc || ""),
    timeZone: String(location.timezoneName || ""),
    days,
  };
};

const DAYS_SHOWN = 8;
const CHART_HOURS = 24;

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

const _windDegrees = (direction) => {
  const index = COMPASS.indexOf(String(direction || "").toUpperCase());
  return index < 0 ? null : index * 22.5;
};

const _localClock = (timeZone, now) => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) || 0 };
  } catch {
    return { date: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
  }
};

const _format = (locale, options, date) => {
  try {
    return new Intl.DateTimeFormat(locale || "en", options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", options).format(date);
  }
};

const _capitalize = (text) => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);

const _weekday = (dateString, locale, length) =>
  _capitalize(_format(locale, { weekday: length, timeZone: "UTC" }, new Date(`${dateString}T12:00:00Z`)));

const _clockLabel = (timeZone, locale, now) => {
  const options = { timeZone: timeZone || "UTC" };
  const weekday = _format(locale, { ...options, weekday: "long" }, now);
  const time = _format(locale, { ...options, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, now);
  return `${_capitalize(weekday)} ${time}`;
};

export const buildView = (forecast, locale, now = new Date()) => {
  const clock = _localClock(forecast.timeZone, now);
  const todayIndex = Math.max(0, forecast.days.findIndex((day) => day.date === clock.date));
  const days = forecast.days.slice(todayIndex, todayIndex + DAYS_SHOWN);
  const hours = days.flatMap((day, dayIndex) => day.hours.map((hour) => ({ ...hour, dayIndex })));
  const nowIndex = Math.max(0, hours.findLastIndex((h) => h.dayIndex === 0 && h.hour <= clock.hour));
  const current = hours[nowIndex] || {};
  const today = days[0];

  return {
    title: forecast.title,
    clock: _clockLabel(forecast.timeZone, locale, now),
    now: {
      temp: today.now?.temp ?? current.temp,
      cond: today.now?.cond ?? current.cond ?? today.cond,
      precip: current.precip,
      humidity: current.humidity,
      wind: current.wind,
    },
    days: days.map((day) => ({
      label: _weekday(day.date, locale, "short"),
      title: _weekday(day.date, locale, "long"),
      cond: day.cond,
      min: day.min,
      max: day.max,
    })),
    chart: {
      start: nowIndex,
      span: CHART_HOURS,
      dayStarts: days.map((_, dayIndex) => Math.max(0, hours.findIndex((h) => h.dayIndex === dayIndex))),
      hours: hours.map((h) => [h.hour, h.temp, h.precip, h.wind, _windDegrees(h.windDir)]),
    },
  };
};

import { conditionIcon, conditionText } from "./conditions.js";
import { esc } from "./text.js";

const NS = "weather-card-slot";

const _t = (key) => `{{ t:${NS}.${key} }}`;

const _external = (url) => `href="${esc(url)}" target="_blank" rel="noopener noreferrer"`;

const _icon = (code, extra = "") => {
  const { icon, tone } = conditionIcon(code);
  return `<i class="fa-solid ${icon} wc-icon wc-icon--${tone} ${extra}" aria-hidden="true"></i>`;
};

const _degrees = (value) => (value === null || value === undefined ? "–" : `${Math.round(value)}°`);

const _round = (value) => (value < 10 ? Math.round(value * 10) / 10 : Math.round(value));

const _detail = (key, value, unit) =>
  value === null || value === undefined ? "" : `<span>${_t(`label.${key}`)}: ${esc(_round(value))}${unit}</span>`;

const _now = (view) => `<div class="wc-now">
  ${_icon(view.now.cond, "wc-icon--now")}
  <span class="wc-temp">${esc(view.now.temp === null || view.now.temp === undefined ? "–" : Math.round(view.now.temp))}</span>
  <span class="wc-unit">°C</span>
  <div class="degoog-text degoog-text--sm degoog-text--secondary wc-details">
    ${_detail("precipitation", view.now.precip, "%")}
    ${_detail("humidity", view.now.humidity, "%")}
    ${_detail("wind", view.now.wind, ` ${_t("unit.wind")}`)}
  </div>
</div>`;

const _place = (view, url) => `<div class="wc-place">
  <a class="wc-city" ${_external(url)}>${esc(view.title)}</a>
  <span class="degoog-text degoog-text--secondary">${esc(view.clock)}</span>
  <span class="degoog-text degoog-text--secondary">${conditionText(view.now.cond)}</span>
</div>`;

const MODES = ["temperature", "precipitation", "wind"];

const _tabs = () =>
  `<div class="wc-tabs" role="tablist">${MODES.map(
    (mode, i) =>
      `<button type="button" role="tab" class="degoog-tab wc-tab${i === 0 ? " active" : ""}" data-wc-mode="${mode}" aria-selected="${i === 0}">${_t(`tab.${mode}`)}</button>`,
  ).join("")}</div>`;

const _day = (day, index) => `<button type="button" class="wc-day${index === 0 ? " active" : ""}" data-wc-day="${index}" aria-pressed="${index === 0}" title="${esc(day.title)}">
  <span class="wc-day-name">${esc(day.label)}</span>
  ${_icon(day.cond, "wc-icon--day")}
  <span class="wc-day-temps"><span class="wc-day-max">${_degrees(day.max)}</span> <span class="wc-day-min">${_degrees(day.min)}</span></span>
</button>`;

export const renderCard = (view, url, source) => `<div class="wc-card" data-wc="${esc(JSON.stringify(view.chart))}" data-wc-wind-unit="${_t("unit.wind")}">
  <div class="wc-top">
    ${_now(view)}
    ${_place(view, url)}
  </div>
  ${_tabs()}
  <div class="wc-chart" data-wc-chart></div>
  <div class="wc-days">${view.days.map(_day).join("")}</div>
  <div class="wc-links">
    <a class="degoog-btn degoog-btn--sm" ${_external(url)}><i class="${esc(source.icon)}" aria-hidden="true"></i>${esc(source.label)}</a>
  </div>
</div>`;

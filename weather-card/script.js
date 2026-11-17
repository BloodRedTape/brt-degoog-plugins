(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const WIDTH = 640;
  const HEIGHT = 150;
  const SIDE = 14;
  const PLOT_TOP = 34;
  const PLOT_BOTTOM = 112;
  const LABEL_Y = 140;
  const LABEL_STEP = 3;
  const MODE = { TEMPERATURE: "temperature", PRECIPITATION: "precipitation", WIND: "wind" };

  const _data = (card) => {
    if (card.wcData !== undefined) return card.wcData;
    try {
      card.wcData = JSON.parse(card.getAttribute("data-wc") || "null");
    } catch {
      card.wcData = null;
    }
    return card.wcData;
  };

  const _dayEnd = (data, day) =>
    Number.isInteger(data.dayStarts[day + 1]) ? data.dayStarts[day + 1] : data.hours.length;

  const _points = (data, day) => {
    if (day === 0) {
      const limit = Number.isInteger(data.dayStarts[2]) ? data.dayStarts[2] : data.hours.length;
      return data.hours.slice(data.start, Math.min(data.start + data.span, limit));
    }
    const start = data.dayStarts[day];
    return Number.isInteger(start) ? data.hours.slice(start, _dayEnd(data, day)) : [];
  };

  const _svg = (name, attrs, text) => {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    if (text !== undefined) el.textContent = text;
    return el;
  };

  const _x = (index, count) => (count <= 1 ? WIDTH / 2 : SIDE + (index * (WIDTH - SIDE * 2)) / (count - 1));

  let labelStep = LABEL_STEP;

  const _labelled = (index) => index % labelStep === 0;

  const _hourLabel = (hour) => `${String(hour).padStart(2, "0")}:00`;

  const _speed = (value) => (value < 10 ? String(Math.round(value * 10) / 10) : String(Math.round(value)));

  function drawHours(svg, points) {
    points.forEach((point, i) => {
      if (!_labelled(i)) return;
      svg.appendChild(_svg("text", { x: _x(i, points.length), y: LABEL_Y, class: "wc-svg-hour" }, _hourLabel(point[0])));
    });
  }

  function drawTemperature(svg, points) {
    const values = points.map((p) => p[1]).filter((v) => typeof v === "number");
    if (!values.length) return;
    const min = Math.min(...values);
    const range = Math.max(...values) - min || 1;
    const coords = points.map((p, i) => {
      const value = typeof p[1] === "number" ? p[1] : min;
      return [_x(i, points.length), PLOT_BOTTOM - ((value - min) / range) * (PLOT_BOTTOM - PLOT_TOP)];
    });
    const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const last = coords[coords.length - 1][0];
    svg.appendChild(_svg("path", { d: `${line} L${last},${PLOT_BOTTOM + 10} L${coords[0][0]},${PLOT_BOTTOM + 10} Z`, class: "wc-svg-area" }));
    svg.appendChild(_svg("path", { d: line, class: "wc-svg-line" }));
    points.forEach((p, i) => {
      if (!_labelled(i) || typeof p[1] !== "number") return;
      svg.appendChild(_svg("text", { x: coords[i][0], y: coords[i][1] - 9, class: "wc-svg-value" }, Math.round(p[1])));
    });
  }

  function drawPrecipitation(svg, points) {
    const step = (WIDTH - SIDE * 2) / Math.max(points.length - 1, 1);
    const barWidth = Math.max(step * 0.55, 2);
    points.forEach((p, i) => {
      const value = typeof p[2] === "number" ? Math.max(0, Math.min(100, p[2])) : 0;
      const height = Math.max((value / 100) * (PLOT_BOTTOM - PLOT_TOP), value > 0 ? 2 : 0);
      const x = _x(i, points.length);
      svg.appendChild(_svg("rect", { x: x - barWidth / 2, y: PLOT_BOTTOM + 10 - height, width: barWidth, height, rx: 2, class: "wc-svg-bar" }));
      if (_labelled(i)) {
        svg.appendChild(_svg("text", { x, y: PLOT_BOTTOM + 2 - height, class: "wc-svg-value" }, `${Math.round(value)}%`));
      }
    });
  }

  function drawWind(svg, points, unit) {
    points.forEach((p, i) => {
      if (!_labelled(i) || typeof p[3] !== "number") return;
      const x = _x(i, points.length);
      const y = (PLOT_TOP + PLOT_BOTTOM) / 2 + 14;
      svg.appendChild(_svg("text", { x, y: y - 22, class: "wc-svg-value" }, `${_speed(p[3])} ${unit}`.trim()));
      if (typeof p[4] === "number") {
        svg.appendChild(_svg("path", { d: "M0,-9 L6,7 L0,3 L-6,7 Z", transform: `translate(${x},${y}) rotate(${p[4] + 180})`, class: "wc-svg-arrow" }));
      }
    });
  }

  function draw(card) {
    const data = _data(card);
    const chart = card.querySelector("[data-wc-chart]");
    if (!data || !chart || !Array.isArray(data.hours)) return;
    const points = _points(data, Number(card.dataset.wcDay || 0));
    const svg = _svg("svg", { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: "wc-svg", "aria-hidden": "true" });
    const mode = card.dataset.wcMode || MODE.TEMPERATURE;
    labelStep = points.length > 8 ? LABEL_STEP : 1;
    if (points.length) {
      if (mode === MODE.PRECIPITATION) drawPrecipitation(svg, points);
      else if (mode === MODE.WIND) drawWind(svg, points, card.getAttribute("data-wc-wind-unit") || "");
      else drawTemperature(svg, points);
      drawHours(svg, points);
    }
    chart.replaceChildren(svg);
  }

  function select(card, selector, active) {
    card.querySelectorAll(selector).forEach((el) => {
      const on = el === active;
      el.classList.toggle("active", on);
      if (el.hasAttribute("aria-selected")) el.setAttribute("aria-selected", String(on));
      if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", String(on));
    });
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const control = target && target.closest(".wc-card [data-wc-mode], .wc-card [data-wc-day]");
    if (!control) return;
    const card = control.closest(".wc-card");
    if (control.hasAttribute("data-wc-mode")) {
      card.dataset.wcMode = control.getAttribute("data-wc-mode");
      select(card, "[data-wc-mode]", control);
    } else {
      card.dataset.wcDay = control.getAttribute("data-wc-day");
      select(card, "[data-wc-day]", control);
    }
    draw(card);
  }

  function setup(card) {
    if (card.dataset.wcReady) return;
    card.dataset.wcReady = "1";
    draw(card);
  }

  function scan(node) {
    if (!(node instanceof Element)) return;
    if (node.matches(".wc-card")) setup(node);
    node.querySelectorAll(".wc-card").forEach(setup);
  }

  document.addEventListener("click", onClick);
  scan(document.documentElement);
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach(scan));
  }).observe(document.documentElement, { childList: true, subtree: true });
})();

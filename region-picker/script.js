const BASE = window.__DEGOOG_BASE_URL__ ?? "";
const ACTION_ID = `${__PLUGIN_ID__}-picker`;
const BUTTON_SELECTOR = `.search-bar-action-btn[data-action-id="${CSS.escape(ACTION_ID)}"]`;
const DB_NAME = "degoog";
const STORE_NAME = "settings";
const REGION_KEY = "search_region";
const REGION_PATTERN = /^[A-Z]{2}$/;
const RESULTS_PATH = /^\/search\/?$/;
const FILTER_MIN_OPTIONS = 8;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 4;
const MENU_MAX_HEIGHT = 360;
const MENU_MIN_HEIGHT = 120;
const FLIP_BELOW_HEIGHT = 180;
const RECENT_STORAGE_KEY = "region-picker-recent";
const MAX_RECENT = 5;

const STRINGS = {
  en: {
    region: "Region",
    none: "No region",
    recent: "Recent",
    clearRecent: "Clear all",
    filter: "Filter regions",
    loading: "Loading…",
    empty: "No engine supports regions.",
    noMatch: "Nothing found.",
    loadError: "Could not load regions.",
    saveError: "Could not save the region.",
  },
  ru: {
    region: "Регион",
    none: "Без региона",
    recent: "Недавние",
    clearRecent: "Очистить",
    filter: "Найти регион",
    loading: "Загрузка…",
    empty: "Ни один движок не поддерживает регионы.",
    noMatch: "Ничего не найдено.",
    loadError: "Не удалось загрузить регионы.",
    saveError: "Не удалось сохранить регион.",
  },
  uk: {
    region: "Регіон",
    none: "Без регіону",
    recent: "Нещодавні",
    clearRecent: "Очистити",
    filter: "Знайти регіон",
    loading: "Завантаження…",
    empty: "Жоден рушій не підтримує регіони.",
    noMatch: "Нічого не знайдено.",
    loadError: "Не вдалося завантажити регіони.",
    saveError: "Не вдалося зберегти регіон.",
  },
};

const _pageLang = () => document.documentElement.lang || "en";

const _str = (key) =>
  (STRINGS[_pageLang().split("-")[0].toLowerCase()] ?? STRINGS.en)[key];

const _normalize = (value) => {
  if (typeof value !== "string") return "";
  const upper = value.trim().toUpperCase();
  return REGION_PATTERN.test(upper) ? upper : "";
};

const _regionNames = (() => {
  try {
    return new Intl.DisplayNames([_pageLang(), "en"], { type: "region" });
  } catch {
    return null;
  }
})();

const _regionLabel = (code) => {
  try {
    return _regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};

const _withStore = (mode, run) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onupgradeneeded = () => request.transaction.abort();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const op = run(tx.objectStore(STORE_NAME));
        tx.oncomplete = () => {
          db.close();
          resolve(op.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      } catch (err) {
        db.close();
        reject(err);
      }
    };
  });

const _readRegion = async () => {
  try {
    return _normalize(await _withStore("readonly", (s) => s.get(REGION_KEY)));
  } catch (err) {
    console.debug("[region-picker] could not read the region", err);
    return "";
  }
};

const _writeRegion = (code) =>
  _withStore("readwrite", (s) => s.put(code, REGION_KEY));

const _loadRecent = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.map(_normalize).filter(Boolean))].slice(0, MAX_RECENT);
  } catch (err) {
    console.debug("[region-picker] could not read recent regions", err);
    return [];
  }
};

const _saveRecent = (codes) => {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(codes));
  } catch (err) {
    console.debug("[region-picker] could not save recent regions", err);
  }
};

const _rememberRecent = (code) => {
  const codes = [code, ..._loadRecent().filter((c) => c !== code)];
  const trimmed = codes.slice(0, MAX_RECENT);
  _saveRecent(trimmed);
  return trimmed;
};

let _regionsRequest = null;

const _fetchRegions = () => {
  _regionsRequest ??= fetch(`${BASE}/api/engines`)
    .then((res) => {
      if (!res.ok) throw new Error(`engines request failed: ${res.status}`);
      return res.json();
    })
    .then((data) => (data.engines ?? []).flatMap((e) => e.regions ?? []))
    .catch((err) => {
      _regionsRequest = null;
      throw err;
    });
  return _regionsRequest;
};

const _toOptions = (codes) =>
  [...new Set(codes.map(_normalize).filter(Boolean))]
    .map((code) => ({ code, label: _regionLabel(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, _pageLang()));

let _region = "";

const _decorate = (btn) => {
  btn.classList.add("region-picker-btn");
  btn.classList.toggle("region-picker-btn--set", !!_region);
  btn.setAttribute("aria-haspopup", "listbox");
  const name = _region ? _regionLabel(_region) : _str("none");
  const title = `${_str("region")}: ${name}`;
  btn.title = title;
  btn.setAttribute("aria-label", title);
  const label = btn.querySelector(".search-bar-action-label");
  if (label) label.textContent = _region;
};

const _decorateAll = () =>
  document.querySelectorAll(BUTTON_SELECTOR).forEach(_decorate);

const _refresh = async () => {
  _region = await _readRegion();
  _decorateAll();
};

const _isResultsPage = () =>
  RESULTS_PATH.test(window.location.pathname.slice(BASE.length));

const _reloadFirstPage = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("page");
  url.searchParams.delete("loaded");
  const state = window.history.state ? { ...window.history.state, page: 1 } : null;
  window.history.replaceState(state, "", url);
  window.location.reload();
};

let _open = null;

const _isRtl = () => getComputedStyle(document.documentElement).direction === "rtl";

const _clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const _place = () => {
  if (!_open) return;
  const { menu, anchor } = _open;
  if (!anchor.isConnected) {
    _close(false);
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
  const above = rect.top - ANCHOR_GAP - VIEWPORT_MARGIN;
  const openUp = below < FLIP_BELOW_HEIGHT && above > below;
  const room = openUp ? above : below;
  menu.style.maxHeight = `${_clamp(room, MENU_MIN_HEIGHT, MENU_MAX_HEIGHT)}px`;
  const width = menu.offsetWidth;
  const left = _isRtl() ? rect.left : rect.right - width;
  menu.style.left = `${_clamp(left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN))}px`;
  menu.style.top = `${openUp ? rect.top - ANCHOR_GAP - menu.offsetHeight : rect.bottom + ANCHOR_GAP}px`;
};

const _onDocumentClick = (e) => {
  if (!_open) return;
  if (_open.menu.contains(e.target) || _open.anchor.contains(e.target)) return;
  _close(false);
};

const _close = (restoreFocus = true) => {
  if (!_open) return;
  const { menu, anchor } = _open;
  _open = null;
  menu.remove();
  anchor.setAttribute("aria-expanded", "false");
  document.removeEventListener("click", _onDocumentClick);
  window.removeEventListener("resize", _place);
  window.removeEventListener("scroll", _place, true);
  if (restoreFocus) anchor.focus();
};

const _el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const _setStatus = (session, text) => {
  session.status.textContent = text ?? "";
  session.status.hidden = !text;
  _place();
};

const _visibleOptions = (session) =>
  [...session.list.querySelectorAll(".region-picker-option")].filter(
    (option) => !option.closest("[hidden]"),
  );

const _select = async (session, code) => {
  if (session.saving) return;
  if (code === _region) {
    _close();
    return;
  }
  session.saving = true;
  try {
    await _writeRegion(code);
  } catch (err) {
    console.warn("[region-picker] could not save the region", err);
    session.saving = false;
    if (_open === session) _setStatus(session, _str("saveError"));
    return;
  }
  _region = code;
  if (code) _rememberRecent(code);
  _decorateAll();
  _close();
  if (_isResultsPage()) _reloadFirstPage();
};

const _renderOption = (session, code, label) => {
  const active = code === _region;
  const option = _el(
    "button",
    `region-picker-option degoog-menu-item degoog-menu-item--option${active ? " region-picker-option--active" : ""}`,
  );
  option.type = "button";
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", active ? "true" : "false");
  option.dataset.search = `${label} ${code}`.toLowerCase();
  option.append(_el("span", "region-picker-name", label));
  if (code) option.append(_el("span", "region-picker-code", code));
  if (active) option.append(_el("span", "region-picker-check", "✓"));
  option.addEventListener("click", () => void _select(session, code));
  return option;
};

const _recentCodes = (available) => {
  const known = new Set(available.map((o) => o.code));
  const stored = _region && !_loadRecent().includes(_region)
    ? _rememberRecent(_region)
    : _loadRecent();
  return stored.filter((code) => known.has(code));
};

const _renderRecent = (session, options) => {
  const codes = _recentCodes(options);
  if (codes.length === 0) return;
  const labels = new Map(options.map((o) => [o.code, o.label]));
  const box = _el("div", "region-picker-recent");
  const header = _el("div", "region-picker-recent-header");
  const clear = _el("button", "region-picker-recent-clear", _str("clearRecent"));
  clear.type = "button";
  clear.addEventListener("click", () => {
    _saveRecent([]);
    box.hidden = true;
    session.recent = null;
    (session.filter ?? _visibleOptions(session)[0])?.focus();
    _place();
  });
  header.append(_el("span", "region-picker-recent-title", _str("recent")), clear);
  box.append(header);
  codes.forEach((code) => box.append(_renderOption(session, code, labels.get(code))));
  session.list.append(box);
  session.recent = box;
};

const _applyFilter = (session) => {
  const query = session.filter?.value.trim().toLowerCase() ?? "";
  let matches = 0;
  if (session.recent) session.recent.hidden = !!query;
  session.list.querySelectorAll(":scope > .region-picker-option").forEach((option) => {
    const match = !query || option.dataset.search.includes(query);
    option.hidden = !match;
    if (match) matches += 1;
  });
  _setStatus(session, matches ? "" : _str("noMatch"));
};

const _addFilter = (session) => {
  const filter = _el(
    "input",
    "region-picker-filter degoog-input degoog-input--sm degoog-input--tools degoog-input--tools-filter",
  );
  filter.type = "text";
  filter.autocomplete = "off";
  filter.placeholder = _str("filter");
  filter.setAttribute("aria-label", _str("filter"));
  filter.addEventListener("input", () => _applyFilter(session));
  filter.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    _visibleOptions(session)[0]?.click();
  });
  session.menu.prepend(filter);
  session.filter = filter;
};

const _focusInitial = (session) => {
  const target =
    session.list.querySelector(".region-picker-option--active") ??
    session.list.querySelector(".region-picker-option");
  target?.scrollIntoView({ block: "nearest" });
  if (session.filter && !window.matchMedia("(pointer: coarse)").matches) {
    session.filter.focus();
    return;
  }
  if (!session.filter) target?.focus();
};

const _populate = async (session) => {
  let declared;
  try {
    [declared] = await Promise.all([_fetchRegions(), _refresh()]);
  } catch (err) {
    console.warn("[region-picker] could not load regions", err);
    if (_open === session) _setStatus(session, _str("loadError"));
    return;
  }
  if (_open !== session) return;
  const options = _toOptions([...declared, _region]);
  if (options.length === 0) {
    _setStatus(session, _str("empty"));
    return;
  }
  _setStatus(session, "");
  _renderRecent(session, options);
  session.list.append(_renderOption(session, "", _str("none")));
  options.forEach(({ code, label }) =>
    session.list.append(_renderOption(session, code, label)),
  );
  if (options.length > FILTER_MIN_OPTIONS) _addFilter(session);
  _place();
  _focusInitial(session);
};

const _moveFocus = (session, step) => {
  const options = _visibleOptions(session);
  if (options.length === 0) return;
  const index = options.indexOf(document.activeElement);
  if (index === -1) {
    options[step > 0 ? 0 : options.length - 1].focus();
    return;
  }
  const next = index + step;
  if (next < 0 && session.filter) {
    session.filter.focus();
    return;
  }
  options[_clamp(next, 0, options.length - 1)].focus();
};

const _onMenuKeydown = (session, e) => {
  e.stopPropagation();
  if (e.key === "Escape") {
    e.preventDefault();
    _close();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    _moveFocus(session, 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    _moveFocus(session, -1);
  }
};

const _openMenu = (anchor) => {
  const menu = _el("div", "region-picker-menu degoog-dropdown degoog-dropdown--submenu");
  const status = _el("div", "region-picker-status", _str("loading"));
  status.setAttribute("role", "status");
  const list = _el("div", "region-picker-list");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", _str("region"));
  menu.append(status, list);

  const session = { menu, anchor, status, list, filter: null, recent: null, saving: false };
  menu.addEventListener("keydown", (e) => _onMenuKeydown(session, e));
  menu.addEventListener("focusout", (e) => {
    if (_open === session && e.relatedTarget && !menu.contains(e.relatedTarget)) {
      _close(false);
    }
  });

  document.body.append(menu);
  _open = session;
  anchor.setAttribute("aria-expanded", "true");
  document.addEventListener("click", _onDocumentClick);
  window.addEventListener("resize", _place);
  window.addEventListener("scroll", _place, { capture: true, passive: true });
  _place();
  void _populate(session);
};

const _toggle = (anchor) => {
  const sameAnchor = _open?.anchor === anchor;
  _close(false);
  if (!sameAnchor) _openMenu(anchor);
};

const _hasPickerButton = (node) =>
  node.nodeType === Node.ELEMENT_NODE &&
  (node.matches(BUTTON_SELECTOR) || !!node.querySelector(BUTTON_SELECTOR));

window.addEventListener("search-bar-action", (e) => {
  if (e.detail?.actionId !== ACTION_ID) return;
  const inputId = CSS.escape(e.detail.inputId ?? "");
  const anchor = document.querySelector(`${BUTTON_SELECTOR}[data-input-id="${inputId}"]`);
  if (anchor) _toggle(anchor);
});

window.addEventListener("pageshow", () => void _refresh());

new MutationObserver((records) => {
  const added = records.some((r) => [...r.addedNodes].some(_hasPickerButton));
  if (added) void _refresh();
}).observe(document.documentElement, { childList: true, subtree: true });

if (document.querySelector(BUTTON_SELECTOR)) void _refresh();

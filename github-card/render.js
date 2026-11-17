import { avatarUrl } from "./github.js";

const NS = "github-card-slot";
const MAX_TOPICS = 6;

const LANGUAGE_COLORS = {
  "C": "#555555", "C#": "#178600", "C++": "#f34b7d", "CSS": "#563d7c", "Dart": "#00b4ab",
  "Dockerfile": "#384d54", "Elixir": "#6e4a7e", "Go": "#00add8", "HTML": "#e34c26", "Haskell": "#5e5086",
  "Java": "#b07219", "JavaScript": "#f1e05a", "Jupyter Notebook": "#da5b0b", "Kotlin": "#a97bff",
  "Lua": "#000080", "Nix": "#7e7eff", "Objective-C": "#438eff", "PHP": "#4f5d95", "Perl": "#0298c3",
  "PowerShell": "#012456", "Python": "#3572a5", "R": "#198ce7", "Ruby": "#701516", "Rust": "#dea584",
  "SCSS": "#c6538c", "Scala": "#c22d40", "Shell": "#89e051", "Svelte": "#ff3e00", "Swift": "#f05138",
  "TypeScript": "#3178c6", "Vue": "#41b883", "Zig": "#ec915c",
};

const TIME_UNITS = [
  ["year", 365 * 864e5],
  ["month", 30 * 864e5],
  ["week", 7 * 864e5],
  ["day", 864e5],
];

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const _t = (key) => `{{ t:${NS}.${key} }}`;

const _external = (url) => `href="${esc(url)}" target="_blank" rel="noopener noreferrer"`;

const _locale = (locale) => {
  try {
    return new Intl.NumberFormat(locale || "en").resolvedOptions().locale;
  } catch {
    return "en";
  }
};

const _count = (value, locale) =>
  new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);

const _ago = (iso, locale) => {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const diff = time - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const unit = TIME_UNITS.find(([, ms]) => Math.abs(diff) >= ms);
  return unit ? rtf.format(Math.round(diff / unit[1]), unit[0]) : rtf.format(0, "day");
};

const _webUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
};

const _avatar = (login, org, env, extra = "") => {
  const src = env.proxy ? env.proxy(avatarUrl(login)) : avatarUrl(login);
  return `<span class="gh-avatar${org ? "" : " gh-avatar--round"} ${extra}"><i class="fa-brands fa-github" aria-hidden="true"></i><img src="${esc(src)}" alt="" loading="lazy" decoding="async"></span>`;
};

const _stat = (icon, label, text) =>
  text === "" ? "" : `<span class="gh-stat"${label ? ` title="${label}"` : ""}><i class="${icon}" aria-hidden="true"></i>${esc(text)}</span>`;

const _number = (icon, label, value, locale) =>
  Number.isFinite(value) ? _stat(icon, label, _count(value, locale)) : "";

const _language = (language) =>
  language
    ? `<span class="gh-stat"><span class="gh-dot" style="--gh-lang:${LANGUAGE_COLORS[language] || "var(--text-secondary)"}"></span>${esc(language)}</span>`
    : "";

const _link = (icon, value) => {
  const url = _webUrl(value);
  return url
    ? `<a class="gh-stat gh-stat-link" ${_external(url.href)}><i class="${icon}" aria-hidden="true"></i>${esc(url.host.replace(/^www\./, "") + url.pathname.replace(/\/$/, ""))}</a>`
    : "";
};

const _stats = (parts) => {
  const html = parts.filter(Boolean).join("");
  return html ? `<div class="gh-stats degoog-text degoog-text--sm degoog-text--secondary">${html}</div>` : "";
};

const _description = (text) => (text ? `<p class="gh-desc">${esc(text)}</p>` : "");

const _topics = (topics) =>
  topics.length
    ? `<div class="gh-topics">${topics.slice(0, MAX_TOPICS).map((topic) => `<span class="gh-topic">${esc(topic)}</span>`).join("")}</div>`
    : "";

const _row = (repo, showOwner, locale) => `<a class="gh-row" ${_external(repo.url)}>
  <span class="gh-row-name">${repo.language ? `<span class="gh-dot" style="--gh-lang:${LANGUAGE_COLORS[repo.language] || "var(--text-secondary)"}" title="${esc(repo.language)}"></span>` : ""}${esc(showOwner ? repo.full : repo.name)}</span>
  <span class="gh-row-desc">${esc(repo.description)}</span>
  <span class="gh-row-stars">${Number.isFinite(repo.stars) ? `<i class="fa-regular fa-star" aria-hidden="true"></i>${esc(_count(repo.stars, locale))}` : ""}</span>
</a>`;

const _rows = (label, repos, showOwner, locale) =>
  repos.length
    ? `<div class="gh-list">
  <div class="degoog-text degoog-text--sm degoog-text--secondary gh-list-label">${_t(label)}</div>
  ${repos.map((repo) => _row(repo, showOwner, locale)).join("")}
</div>`
    : "";

export const renderRepo = ({ main, related }, env) => {
  const locale = _locale(env.locale);
  return `<div class="gh-card">
  <div class="gh-head">
    ${_avatar(main.owner, main.org, env)}
    <div class="gh-heading">
      <a class="gh-title" ${_external(main.url)}><span class="gh-owner">${esc(main.owner)}</span><span class="gh-slash">/</span><span class="gh-name">${esc(main.name)}</span></a>
      ${main.archived ? `<span class="gh-flag">${_t("archived")}</span>` : ""}
      ${main.parent ? `<div class="degoog-text degoog-text--sm degoog-text--secondary">${_t("fork_of")} <a class="gh-inline-link" ${_external(`https://github.com/${main.parent}`)}>${esc(main.parent)}</a></div>` : ""}
    </div>
  </div>
  ${_description(main.description)}
  ${_stats([
    _number("fa-regular fa-star", _t("stars"), main.stars, locale),
    _number("fa-solid fa-code-fork", _t("forks"), main.forks, locale),
    _language(main.language),
    main.license ? _stat("fa-solid fa-scale-balanced", _t("license"), main.license) : "",
    main.pushed ? _stat("fa-regular fa-clock", _t("updated"), _ago(main.pushed, locale)) : "",
    _link("fa-solid fa-link", main.homepage),
  ])}
  ${_topics(main.topics)}
  ${_rows("related", related, true, locale)}
</div>`;
};

export const renderOwner = ({ owner, repos }, env) => {
  const locale = _locale(env.locale);
  return `<div class="gh-card">
  <div class="gh-head">
    ${_avatar(owner.login, owner.org, env, "gh-avatar--large")}
    <div class="gh-heading">
      <a class="gh-title" ${_external(owner.url)}><span class="gh-name">${esc(owner.name || owner.login)}</span></a>
      <div class="degoog-text degoog-text--sm degoog-text--secondary">${owner.name ? `@${esc(owner.login)} · ` : ""}${_t(owner.org ? "kind.org" : "kind.user")}</div>
    </div>
  </div>
  ${_description(owner.bio)}
  ${_stats([
    _number("fa-solid fa-book", _t("repos"), owner.repos, locale),
    _number("fa-solid fa-user-group", _t("followers"), owner.followers, locale),
    owner.location ? _stat("fa-solid fa-location-dot", "", owner.location) : "",
    _link("fa-solid fa-link", owner.blog),
  ])}
  ${_rows("repositories", repos, false, locale)}
</div>`;
};

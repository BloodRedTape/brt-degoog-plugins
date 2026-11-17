import { createApi, parseLink } from "./github.js";
import { queryMatcher } from "./match.js";
import { renderOwner, renderRepo } from "./render.js";

const MAX_RESULTS = 10;
const MAX_RELATED = 3;
const MAX_OWNER_REPOS = 5;
const FETCH_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const LAYOUT = { FULL_WIDTH: "full-width", PANEL: "panel" };
const LAYOUT_POSITION = {
  [LAYOUT.FULL_WIDTH]: "full-width-above-results",
  [LAYOUT.PANEL]: "above-results",
};

let cache = null;
let token = "";

const _ranked = (results) =>
  results
    .map((result, index) => ({ result, index }))
    .sort((a, b) => (Number(b.result?.score) || 0) - (Number(a.result?.score) || 0) || a.index - b.index)
    .map(({ result }) => result);

const _parseUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
};

const _mentions = (results) => {
  const repos = new Map();
  const owners = new Map();
  if (!Array.isArray(results)) return { repos: [], owners: [] };
  for (const result of _ranked(results).slice(0, MAX_RESULTS)) {
    const url = _parseUrl(result?.url);
    const link = url && parseLink(url, result?.title);
    if (!link) continue;
    const login = link.type === "user" ? link.login : link.owner;
    if (!owners.has(login.toLowerCase())) owners.set(login.toLowerCase(), login);
    if (link.type !== "repo") continue;
    const key = link.full.toLowerCase();
    const known = repos.get(key);
    if (!known) repos.set(key, link);
    else if (!known.description && link.description) known.description = link.description;
  }
  return { repos: [...repos.values()], owners: [...owners.values()] };
};

const _pick = (query, { repos, owners }) => {
  const matches = queryMatcher(query);
  const repo = repos.find((r) => matches(r.repo));
  if (repo) {
    const related = repos.filter((r) => r !== repo && matches(r.repo)).slice(0, MAX_RELATED);
    return { type: "repo", repo, related };
  }
  const login = owners.find((o) => matches(o));
  return login ? { type: "owner", login, repos: repos.filter((r) => r.owner.toLowerCase() === login.toLowerCase()) } : null;
};

const _repoView = (data, mention) => ({
  owner: data?.owner?.login || mention.owner,
  name: data?.name || mention.repo,
  full: data?.full_name || mention.full,
  url: data?.html_url || `https://github.com/${mention.full}`,
  description: (data?.description || mention.description || "").trim(),
  org: data?.owner?.type === "Organization",
  stars: data?.stargazers_count,
  forks: data?.forks_count,
  language: data?.language || "",
  license: data?.license?.spdx_id && data.license.spdx_id !== "NOASSERTION" ? data.license.spdx_id : "",
  pushed: data?.pushed_at || "",
  homepage: data?.homepage || "",
  topics: Array.isArray(data?.topics) ? data.topics : [],
  archived: Boolean(data?.archived),
  parent: data?.parent?.full_name || "",
});

const _mentionOfItem = (item) => ({ owner: item.owner?.login, repo: item.name, full: item.full_name, description: "" });

const _repoCard = async (pick, api) => {
  const all = [pick.repo, ...pick.related];
  const data = await Promise.all(all.map((r) => api.repo(r.full)));
  const [main, ...related] = all.map((r, i) => _repoView(data[i], r));
  return { main, related };
};

const _ownerCard = async (pick, api) => {
  const [user, top] = await Promise.all([api.user(pick.login), api.topRepos(pick.login, MAX_OWNER_REPOS + 1)]);
  const byName = new Map(top.map((item) => [item.full_name.toLowerCase(), item]));
  const fromResults = pick.repos.map((r) => _repoView(byName.get(r.full.toLowerCase()), r));
  const seen = new Set(fromResults.map((r) => r.full.toLowerCase()));
  const fromTop = top.filter((item) => !seen.has(item.full_name.toLowerCase())).map((item) => _repoView(item, _mentionOfItem(item)));
  return {
    owner: {
      login: user?.login || pick.login,
      name: user?.name || "",
      url: user?.html_url || `https://github.com/${pick.login}`,
      org: user?.type === "Organization",
      bio: (user?.bio || user?.description || "").trim(),
      repos: user?.public_repos,
      followers: user?.followers,
      location: user?.location || "",
      blog: user?.blog || "",
    },
    repos: [...fromResults, ...fromTop].slice(0, MAX_OWNER_REPOS),
  };
};

export const slot = {
  isClientExposed: false,
  id: "github-card",
  name: "GitHub card",
  description: "Shows a repository or profile card when the results link to it on GitHub.",
  position: LAYOUT_POSITION[LAYOUT.PANEL],
  waitForResults: true,

  settingsSchema: [
    {
      key: "layout",
      label: "Layout",
      type: "select",
      options: [LAYOUT.FULL_WIDTH, LAYOUT.PANEL],
      optionLabels: ["Full width above results", "Panel above results"],
      default: LAYOUT.PANEL,
      description: "Where the card appears and how it is framed.",
    },
    {
      key: "token",
      label: "GitHub token",
      type: "password",
      secret: true,
      placeholder: "Optional",
      description: "Personal access token. Without it GitHub allows 60 requests per hour.",
    },
  ],

  configure(settings) {
    const layout = settings?.layout === LAYOUT.FULL_WIDTH ? LAYOUT.FULL_WIDTH : LAYOUT.PANEL;
    slot.position = LAYOUT_POSITION[layout];
    token = typeof settings?.token === "string" ? settings.token.trim() : "";
  },

  init(ctx) {
    cache = typeof ctx?.useCache === "function" ? ctx.useCache("ext:github-card:api", CACHE_TTL_MS) : null;
  },

  trigger() {
    return true;
  },

  async execute(query, context) {
    const pick = _pick(query, _mentions(context?.results));
    if (!pick) return { html: "" };
    const api = createApi({ fetchFn: context?.fetch ?? fetch, cache, token, timeoutMs: FETCH_TIMEOUT_MS });
    const env = { locale: context?.locale, proxy: context?.signProxyUrl };
    if (pick.type === "repo") return { title: "", html: renderRepo(await _repoCard(pick, api), env) };
    return { title: "", html: renderOwner(await _ownerCard(pick, api), env) };
  },
};

export default { slot };

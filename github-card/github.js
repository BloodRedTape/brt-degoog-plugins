const API = "https://api.github.com";
const AVATAR = "https://avatars.githubusercontent.com";
const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const TITLE_RE = /^(?:GitHub\s*[-–—]\s*)?([^\s:]+\/[^\s:]+)\s*:\s*(.+?)(?:\s*[-–—·|]\s*GitHub)?\s*$/i;

const RESERVED = new Set([
  "about", "apps", "blog", "codespaces", "collections", "contact", "customer-stories", "enterprise",
  "events", "explore", "features", "issues", "login", "marketplace", "mobile", "new", "notifications",
  "organizations", "orgs", "pricing", "pulls", "readme", "repos", "repositories", "search", "security",
  "settings", "site", "sponsors", "stars", "team", "terms", "privacy", "topics", "trending", "users",
]);

const limitedUntil = {};

export const avatarUrl = (login, size = 96) => `${AVATAR}/${encodeURIComponent(login)}?s=${size}`;

const _titleDescription = (title, full) => {
  const match = TITLE_RE.exec(String(title || "").trim());
  return match && match[1].toLowerCase() === full.toLowerCase() ? match[2].trim() : "";
};

export const parseLink = (url, title) => {
  if (url.hostname.toLowerCase().replace(/^www\./, "") !== "github.com") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (!segments.length) return null;
  if (segments[0].toLowerCase() === "orgs" && LOGIN_RE.test(segments[1] || "")) {
    return { type: "user", login: segments[1] };
  }
  const [owner, rawRepo] = segments;
  if (!LOGIN_RE.test(owner) || RESERVED.has(owner.toLowerCase())) return null;
  if (!rawRepo) return { type: "user", login: owner };
  const repo = rawRepo.replace(/\.git$/i, "");
  if (!REPO_RE.test(repo)) return null;
  const full = `${owner}/${repo}`;
  const home = segments.length === 2;
  return { type: "repo", owner, repo, full, home, description: home ? _titleDescription(title, full) : "" };
};

export const createApi = ({ fetchFn, cache, token, timeoutMs }) => {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "degoog-github-card",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const _get = async (path, bucket) => {
    if (Date.now() < (limitedUntil[bucket] || 0)) return null;
    const url = `${API}${path}`;
    const cached = cache ? await cache.get(url) : null;
    if (cached) return cached.missing ? null : cached;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { headers, signal: controller.signal });
      if (res.status === 404) {
        if (cache) await cache.set(url, { missing: true });
        return null;
      }
      if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
        limitedUntil[bucket] = Number(res.headers.get("x-ratelimit-reset")) * 1000 || Date.now() + 60000;
        return null;
      }
      if (!res.ok) return null;
      const data = await res.json();
      if (data && cache) await cache.set(url, data);
      return data;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const _path = (value) => value.split("/").map(encodeURIComponent).join("/");

  return {
    repo: (full) => _get(`/repos/${_path(full)}`, "core"),
    user: (login) => _get(`/users/${encodeURIComponent(login)}`, "core"),
    topRepos: async (login, count) => {
      const params = new URLSearchParams({ q: `user:${login}`, sort: "stars", order: "desc", per_page: String(count) });
      const data = await _get(`/search/repositories?${params}`, "search");
      return Array.isArray(data?.items) ? data.items : [];
    },
  };
};

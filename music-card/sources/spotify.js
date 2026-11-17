import { cleanText } from "../text.js";

const OEMBED = "https://open.spotify.com/oembed";
const KINDS = new Set(["track", "album", "artist"]);
const ID_RE = /^[A-Za-z0-9]{22}$/;
const IMAGE_HOST_RE = /(?:^|\.)(?:spotifycdn\.com|scdn\.co)$/;

const TITLE_PATTERNS = {
  track: /^(.+?)\s+[-–—]\s+(?:song|single)\b.*?\s+by\s+(.+)$/i,
  album: /^(.+?)\s+[-–—]\s+(?:album|single|ep|compilation)\b.*?\s+by\s+(.+)$/i,
};

const _pageUrl = (kind, id) => `https://open.spotify.com/${kind}/${id}`;

const _oembed = (kind, id, fetchJson) =>
  fetchJson(`${OEMBED}?url=${encodeURIComponent(_pageUrl(kind, id))}`);

const _parse = (url, title) => {
  if (url.hostname !== "open.spotify.com") return null;
  const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|artist)\/([A-Za-z0-9]{22})\/?$/);
  if (!match) return null;
  const kind = match[1];
  const text = cleanText(title).replace(/\s*[|–—-]\s*Spotify\s*$/i, "").replace(/^Listen to\s+/i, "");
  const parsed = kind === "artist" ? [null, text, ""] : text.match(TITLE_PATTERNS[kind]);
  return {
    kind,
    id: match[2],
    name: cleanText(parsed?.[1]),
    artist: cleanText(parsed?.[2]),
    url: _pageUrl(kind, match[2]),
  };
};

const _details = async (mention, fetchJson) => {
  const data = await _oembed(mention.kind, mention.id, fetchJson);
  return { name: cleanText(data?.title) };
};

const _cover = async (kind, id, fetchJson) => {
  if (!KINDS.has(kind) || !ID_RE.test(id || "")) return "";
  const data = await _oembed(kind, id, fetchJson);
  try {
    const url = new URL(String(data?.thumbnail_url || ""));
    return url.protocol === "https:" && IMAGE_HOST_RE.test(url.hostname) ? url.toString() : "";
  } catch {
    return "";
  }
};

export default {
  id: "spotify",
  label: "Spotify",
  icon: "fa-brands fa-spotify",
  primary: true,
  parse: _parse,
  details: _details,
  cover: _cover,
};

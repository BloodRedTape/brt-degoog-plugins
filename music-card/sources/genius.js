import { cleanText, dropTransliteration, splitDash } from "../text.js";

const SITE_SUFFIX = /\s*(?:\|\s*Genius(?:\s+Lyrics)?|[-–—]\s*Genius)\s*$/i;

const _artistAndName = (kind, text, url) => {
  const parts = splitDash(text);
  if (!parts) return null;
  return { kind, id: "", name: dropTransliteration(parts[1]), artist: dropTransliteration(parts[0]), url };
};

const _parse = (url, title) => {
  if (url.hostname !== "genius.com") return null;
  const text = cleanText(title).replace(SITE_SUFFIX, "");
  const page = `https://genius.com${url.pathname}`;
  if (/^\/[^/]+-lyrics\/?$/.test(url.pathname)) {
    return _artistAndName("track", text.replace(/\s+Lyrics\s*$/i, ""), page);
  }
  if (/^\/albums\/[^/]+\/[^/]+\/?$/.test(url.pathname)) {
    return _artistAndName("album", text.replace(/\s+Lyrics(?:\s+and\s+Tracklist)?\s*$/i, ""), page);
  }
  if (/^\/artists\/[^/]+\/?$/.test(url.pathname)) {
    const name = dropTransliteration(text.replace(/\s+Lyrics,?\s+Songs,?\s+and\s+Albums\s*$/i, ""));
    return name ? { kind: "artist", id: "", name, artist: "", url: page } : null;
  }
  return null;
};

export default {
  id: "genius",
  label: "Genius",
  icon: "fa-solid fa-microphone-lines",
  primary: false,
  parse: _parse,
};

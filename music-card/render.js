import { esc } from "./text.js";

const NS = "music-card-slot";

const _t = (key) => `{{ t:${NS}.${key} }}`;

const _external = (url) => `href="${esc(url)}" target="_blank" rel="noopener noreferrer"`;

const _cover = (card) => {
  const icon = `<i class="fa-solid ${card.kind === "artist" ? "fa-user" : "fa-music"}" aria-hidden="true"></i>`;
  return card.image ? `${icon}<img src="${esc(card.image)}" alt="" decoding="async">` : icon;
};

const _byline = (card) =>
  card.artist && card.kind !== "artist"
    ? `<span class="degoog-text degoog-text--secondary">${_t(`by.${card.kind}`)} <span class="mc-strong">${esc(card.artist)}</span></span>`
    : "";

const _fact = (fact) =>
  `<div class="mc-fact"><dt class="degoog-text degoog-text--sm degoog-text--secondary">${_t(`fact.${fact.key}`)}</dt><dd class="degoog-text">${esc(fact.value)}</dd></div>`;

const _facts = (card) => (card.facts.length ? `<dl class="mc-facts">${card.facts.map(_fact).join("")}</dl>` : "");

const _link = (link) =>
  `<a class="degoog-btn degoog-btn--sm mc-link mc-link--${esc(link.id)}" ${_external(link.url)}><i class="${esc(link.icon)}" aria-hidden="true"></i>${esc(link.label)}</a>`;

export const renderCard = (card) => `<div class="mc-card mc-card--${esc(card.kind)}">
  <a class="mc-cover" ${_external(card.url)} tabindex="-1" aria-hidden="true">${_cover(card)}</a>
  <div class="mc-main">
    <div class="mc-head">
      <span class="degoog-text degoog-text--sm degoog-text--secondary mc-kicker">${_t(`kind.${card.kind}`)}</span>
      <a class="mc-title" ${_external(card.url)}>${esc(card.name)}</a>
      ${_byline(card)}
    </div>
    ${_facts(card)}
    <div class="mc-links">${card.links.map(_link).join("")}</div>
  </div>
</div>`;

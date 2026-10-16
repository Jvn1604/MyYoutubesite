/**
 * Auto-assign a synced video to a game by matching the game's title keywords
 * (games.title_keywords) against the video title. Only used when the admin
 * hasn't locked a game choice for that video.
 */

const normalize = (s) =>
  s.toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * @param {string} title
 * @param {{ id:number, slug:string, keywords:string[] }[]} games
 * @returns {number|null} game id of the most specific (longest) keyword match
 */
export function matchGame(title, games) {
  const haystack = ` ${normalize(title)} `;
  let best = null;
  for (const g of games) {
    for (const kw of g.keywords ?? []) {
      const needle = normalize(kw);
      if (needle.length < 3) continue; // too ambiguous
      if (haystack.includes(` ${needle} `) && (!best || needle.length > best.length)) best = { id: g.id, length: needle.length };
    }
  }
  return best?.id ?? null;
}

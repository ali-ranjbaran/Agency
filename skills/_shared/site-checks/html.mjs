/** Dependency-free HTML helpers (regex-based; good enough for checks, not a full parser). */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', copy: "©", hellip: "…" };
export const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
export const attrs = (s) => {
  const out = {};
  for (const m of s.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
};
export const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((m) => ({ ...attrs(m[1]), _index: m.index }));
export const blocks = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)</${name}>`, "gi"))].map((m) => ({ attrs: attrs(m[1]), inner: m[2], index: m.index }));
export const textOf = (html) => decode(html
  .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(p|div|section|header|footer|li|h[1-6]|tr|article|nav|main|aside|form|button|a)>/gi, "\n")
  .replace(/<[^>]+>/g, " "))
  .replace(/[ \t\f\v\r]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();
export const has = (s, re) => re.test(s);
export const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-](\d{4})\b/g;

/**
 * Broken links. Internal: every unique same-origin URL linked from a crawled page must answer
 * 2xx/3xx (pages already crawled reuse their status). External: HEAD (GET if HEAD isn't allowed),
 * max 50, one at a time; only 404/410 count as broken (many sites refuse bots with 403/429).
 */
import { safeGet } from "../../../../_shared/site-checks/fetch.mjs";
import { UA } from "./browse.mjs";

export async function checkLinks(pages, origin, { allowLocal, auth } = {}) {
  const known = new Map(pages.map((p) => [p.url.replace(/\/$/, ""), p.status]));
  const internal = new Map(), external = new Map();
  for (const p of pages) for (const href of p.links ?? []) {
    let u; try { u = new URL(href); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = "";
    (u.origin === origin ? internal : external).set(u.href, p.url);
  }
  const broken = [];
  for (const [href, from] of internal) {
    const k = href.replace(/\/$/, "");
    let status = known.get(k);
    if (status === undefined) {
      status = await fetch(href, { headers: { "user-agent": UA, ...(auth ? { authorization: auth } : {}) }, redirect: "follow", signal: AbortSignal.timeout(20_000) })
        .then((r) => r.status).catch(() => 0);
      known.set(k, status);
    }
    if (!(status >= 200 && status < 400)) broken.push(`${href} → ${status || "no response"} (linked from ${from})`);
  }
  let checkedExt = 0;
  const extBroken = [];
  for (const [href, from] of [...external].slice(0, 50)) {
    checkedExt++;
    try {
      let r = await safeGet(href, { method: "HEAD", maxBytes: 1, userAgent: UA, allowLocal, timeout: 15_000 });
      if (r.status === 405 || r.status === 501) r = await safeGet(href, { maxBytes: 50_000, userAgent: UA, allowLocal, timeout: 15_000 });
      if (r.status === 404 || r.status === 410) extBroken.push(`${href} → ${r.status} (linked from ${from})`);
    } catch { /* unreachable or refused by the SSRF guard: not counted as broken */ }
  }
  return { internalChecked: internal.size, externalChecked: checkedExt, externalTotal: external.size, broken, extBroken };
}

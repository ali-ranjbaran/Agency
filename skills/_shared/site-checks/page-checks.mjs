/**
 * Neutral page checks, shared by audit-site (sales: graded pass/warn/fail + offer mapping) and
 * qa-site (launch gate: strict PASS/FAIL/UNVERIFIED/N/A). Nothing here decides a verdict:
 * parsePage() returns facts, the fetch checks return { ok, evidence, data } with ok = null when
 * it couldn't be determined. Each skill applies its own standard.
 */
import { safeGet } from "./fetch.mjs";
import { PHONE_RE, blocks, decode, tags, textOf } from "./html.mjs";

/** schema.org LocalBusiness and the subtypes trade and service businesses use. */
export const LOCAL_BUSINESS_TYPES = /^(LocalBusiness|ProfessionalService|HomeAndConstructionBusiness|HVACBusiness|Plumber|Electrician|RoofingContractor|GeneralContractor|HousePainter|Locksmith|MovingCompany|AutomotiveBusiness|AutoRepair|Store|FinancialService|LegalService|MedicalBusiness|EmergencyService)$/i;

/** Everything both skills read from one page's HTML. */
export function parsePage(html) {
  const head = (html.match(/<head\b[\s\S]*?<\/head>/i) ?? [""])[0];
  const metas = tags(head, "meta");
  const meta = (k) => metas.find((m) => (m.name ?? "").toLowerCase() === k)?.content ?? "";
  const prop = (k) => metas.find((m) => (m.property ?? "").toLowerCase() === k)?.content ?? "";
  const links = tags(html, "a").map((t) => ({ ...t, href: t.href ?? "" }));
  const aBlocks = blocks(html, "a").map((b) => ({ href: b.attrs.href ?? "", text: textOf(b.inner) }));
  const ldjson = blocks(html, "script").filter((b) => /ld\+json/i.test(b.attrs.type ?? "")).map((b) => b.inner);
  const schemaTypes = [...new Set(ldjson.flatMap((j) => [...j.matchAll(/"@type"\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/g)].flatMap((m) => (m[1] ?? m[2]).split(",").map((s) => s.replace(/["\s]/g, "")))))];
  return {
    head,
    title: decode((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [, ""])[1]).trim(),
    metas,
    metaDesc: meta("description"),
    viewport: meta("viewport"),
    robotsMeta: meta("robots"),
    ogSite: prop("og:site_name"),
    ogTitle: prop("og:title"),
    ogImage: prop("og:image"),
    ogDescription: prop("og:description"),
    canonical: tags(head, "link").find((l) => (l.rel ?? "").toLowerCase().split(/\s+/).includes("canonical"))?.href ?? "",
    htmlLang: (html.match(/<html\b([^>]*)>/i) ?? [, ""])[1],
    h1s: blocks(html, "h1").map((b) => textOf(b.inner)).filter(Boolean),
    links,
    aBlocks,
    telLinks: links.filter((l) => /^tel:/i.test(l.href)),
    scriptSrcs: tags(html, "script").map((t) => t.src).filter(Boolean),
    ldjson,
    schemaTypes,
    localBusiness: schemaTypes.filter((t) => LOCAL_BUSINESS_TYPES.test(t)),
    privacyLink: aBlocks.find((a) => /privacy/i.test(a.text) || /privacy/i.test(a.href)) ?? null,
    termsLink: aBlocks.find((a) => /\bterms\b/i.test(a.text) || /terms/i.test(a.href)) ?? null,
  };
}

/** A tel: href is a dialable NANP number (+1 and 10 digits, or 10/11 digits). */
export function telValid(href) {
  const d = String(href).replace(/^tel:/i, "").replace(/[^\d+]/g, "");
  return /^(\+?1)?[2-9]\d{2}[2-9]\d{6}$/.test(d);
}

export function phonesInText(text) {
  const out = [...new Set([...text.matchAll(PHONE_RE)].map((m) => `(${m[1]}) ${m[2]}-${m[3]}`))];
  PHONE_RE.lastIndex = 0;
  return out;
}

export async function robotsTxt(origin, opts = {}) {
  try {
    const r = await safeGet(`${origin}/robots.txt`, { maxBytes: 200_000, ...opts });
    const disallowAll = /user-agent:\s*\*[\s\S]*?\n\s*disallow:\s*\/\s*(\n|$)/i.test(`${r.text}\n`);
    return { ok: r.status === 200, evidence: `HTTP ${r.status}${disallowAll ? ", Disallow: / for all agents" : ""}`, data: { status: r.status, text: r.text, disallowAll } };
  } catch (e) {
    return { ok: null, evidence: `robots.txt not fetched: ${e.message}`, data: null };
  }
}

export async function sitemapXml(origin, opts = {}) {
  try {
    const r = await safeGet(`${origin}/sitemap.xml`, { maxBytes: 500_000, ...opts });
    const valid = r.status === 200 && /<(urlset|sitemapindex)/i.test(r.text);
    const urls = [...r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));
    return { ok: valid, evidence: `HTTP ${r.status}${valid ? `, ${urls.length} URL(s)` : ""}`, data: { status: r.status, urls } };
  } catch (e) {
    return { ok: null, evidence: `sitemap.xml not fetched: ${e.message}`, data: null };
  }
}

/** Does plain http:// redirect to https://? ok = null when it can't be tested (site is http, or fetch failed). */
export async function httpsRedirect(base, opts = {}) {
  if (base.protocol !== "https:") return { ok: false, evidence: "Site serves over plain http", data: { https: false } };
  try {
    const r = await safeGet(`http://${base.host}/`, { maxBytes: 50_000, ...opts });
    const first = r.hops[0];
    return {
      ok: r.url.startsWith("https:"),
      evidence: r.url.startsWith("https:") ? `http → https (${first ? `HTTP ${first.status}` : "direct"})` : "http:// did not redirect to https",
      data: { https: true, firstHopStatus: first?.status ?? null, final: r.url },
    };
  } catch (e) {
    return { ok: null, evidence: `http:// not testable: ${e.message}`, data: { https: true } };
  }
}

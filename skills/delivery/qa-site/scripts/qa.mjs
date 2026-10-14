#!/usr/bin/env node
/**
 * qa-site: the pre-launch gate.
 *   node qa.mjs <url> --mode prospect-preview|client-staging|production
 *        [--repo <site repo>] [--confirm <check-id>="what you checked"]… [--confirm-lead <email>]
 *        [--max-pages 25] [--allow-local] [--d1-local <persist dir>] [--out <dir>]
 *   Preview password: QA_PREVIEW_PASSWORD (user: QA_PREVIEW_USER, default "preview"). Never an argument.
 * Writes ~/Arkosa-leads/qa/<date>-<domain>/report.md (+ checks.json, screenshots/, network.json, axe.json, lighthouse-*.json).
 * Exit: 1 = LAUNCH BLOCKED (any FAIL) · 2 = NOT CLEARED (UNVERIFIED items) · 0 = CLEARED.
 * Standards: ../references/checks.md
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { assertPublicUrl, safeGet } from "../../../_shared/site-checks/fetch.mjs";
import { httpsRedirect, robotsTxt, sitemapXml, telValid } from "../../../_shared/site-checks/page-checks.mjs";
import { detect } from "../../../_shared/site-checks/detect.mjs";
import { FAIL, NA, PASS, Results, UNVERIFIED, writeReport } from "./lib/result.mjs";
import { UA, inspectPage, pickPages } from "./lib/browse.mjs";
import { runLighthouse } from "./lib/lighthouse.mjs";
import { observeTracking } from "./lib/tracking.mjs";
import { pickFormPage, probeCaps, probeGuards, submitThroughUi, testLead } from "./lib/form.mjs";
import { confirmArrival, detectDestination } from "./lib/destination.mjs";
import { envValues, scanBuild, scanText } from "./lib/secrets.mjs";
import { checkLinks } from "./lib/links.mjs";

const MODES = ["prospect-preview", "client-staging", "production"];
const HUMAN = {
  "a11y.keyboard": ["Keyboard pass (Tab through every page: visible focus, logical order, no traps)", "Tab through each page and the form; then re-run with --confirm a11y.keyboard=\"…\""],
  "tel.device": ["tel: links tested on a real phone", "Tap every phone link on a real phone; then --confirm tel.device=\"…\""],
  "form.followup": ["Follow-up automation fired for the test lead", "Check the CRM: the test lead's follow-up (text/email) fired; then --confirm form.followup=\"…\""],
  gbp: ["Google Business Profile claimed, NAP matches the site, links to it", "Open the profile; compare name, address, phone with the site; then --confirm gbp=\"…\""],
};

// ---- args ---------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const confirms = Object.fromEntries(argv.flatMap((a, i) => (a === "--confirm" ? [argv[i + 1]] : [])).filter(Boolean).map((c) => { const j = c.indexOf("="); return [c.slice(0, j), c.slice(j + 1)]; }));
const target = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !argv[i - 1].startsWith("--")));
const mode = opt("--mode");
const allowLocal = argv.includes("--allow-local");
const repo = opt("--repo") ? resolve(opt("--repo")) : null;
const maxPages = Number(opt("--max-pages") ?? 25);
if (!target || !MODES.includes(mode)) {
  console.error("usage: node qa.mjs <url> --mode prospect-preview|client-staging|production [--repo <path>] [--confirm id=note]…");
  process.exit(64);
}
if (repo && !existsSync(repo)) { console.error(`--repo ${repo} does not exist`); process.exit(64); }
const startUrl = (await assertPublicUrl(/^https?:\/\//.test(target) ? target : `https://${target}`, { allowLocal })).href;
const base = new URL(startUrl);
const origin = base.origin;
const isProd = mode === "production", isPreview = mode === "prospect-preview";
const credentials = process.env.QA_PREVIEW_PASSWORD ? { username: process.env.QA_PREVIEW_USER || "preview", password: process.env.QA_PREVIEW_PASSWORD } : null;
const authHeader = credentials ? `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}` : null;

const stamp = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
let out = opt("--out") ?? join(homedir(), "Arkosa-leads", "qa", `${stamp}-${base.host.replace(/[^a-z0-9.-]+/gi, "-")}`);
for (let n = 2; !opt("--out") && existsSync(out); n++) out = out.replace(/(-\d+)?$/, `-${n}`);
const shotDir = join(out, "screenshots");
mkdirSync(shotDir, { recursive: true, mode: 0o700 });
const startedAt = new Date().toISOString();
const runId = startedAt.replace(/\D/g, "").slice(0, 14);
const R = new Results();
const log = (...a) => console.log(`[qa] ${a.join(" ")}`);
const TITLES = {
  "form.guards": "Form refuses bad requests (no token, foreign origin, oversized)", "form.caps": "Rate cap refuses a burst (429)", "form.followup": "Follow-up automation fired for the test lead",
  "seo.meta": "Title, description, og:title, og:image (loads), canonical on every page", "seo.robots": "robots.txt answers and doesn't block everything",
  "seo.sitemap": "sitemap.xml answers with same-origin URLs", "seo.indexable": "Production pages are indexable (no noindex)", "seo.localbusiness": "LocalBusiness structured data",
  "https.redirect": "HTTPS forced; www and non-www resolve to one host", "legal.terms": "Terms page", "preview.access": "Preview needs a password (unlisted / protected)",
  "preview.noindex": "Preview is not indexable (noindex on every page, robots Disallow: /)", "preview.banner": "PreviewBanner on every page", "preview.form": "Preview form refuses leads",
};
const na = (id, title, why) => R.add(id, TITLES[id] && title === id ? TITLES[id] : title, NA, why);

// ---- crawl ----------------------------------------------------------------------------------
const browser = await chromium.launch();
log(`${startUrl} · ${mode} → ${out}`);
const home = await inspectPage(browser, startUrl, { credentials, shotDir, index: 0 });
if (home.error || !(home.status >= 200 && home.status < 400)) {
  R.add("site.reachable", "Home page loads", FAIL, `${startUrl}: ${home.error ?? `HTTP ${home.status}`}${home.status === 401 && !credentials ? " (password-protected: set QA_PREVIEW_PASSWORD)" : ""}`, "Make the URL reachable for the check.");
  await browser.close();
  const v = writeReport(out, { url: startUrl, mode, startedAt, finishedAt: new Date().toISOString(), results: R, artifacts: { report: join(out, "report.md") }, repo });
  console.log(`${v.line}\n${join(out, "report.md")}`);
  process.exit(v.exit);
}
const sm = isPreview ? null : await sitemapXml(origin, { allowLocal });
const urls = pickPages(origin, home.links, sm?.data?.urls, maxPages);
const pages = [home];
for (const [i, u] of urls.slice(1).entries()) { log(`page ${i + 2}/${urls.length} ${u}`); pages.push(await inspectPage(browser, u, { credentials, shotDir, index: i + 1 })); }
const ok = pages.filter((p) => !p.error && p.status >= 200 && p.status < 400);
R.add("site.reachable", "Pages load", ok.length === pages.length ? PASS : FAIL, [`${ok.length}/${pages.length} pages loaded`, ...pages.filter((p) => !ok.includes(p)).map((p) => `${p.url}: ${p.error ?? `HTTP ${p.status}`}`)], "Fix the pages that don't load.");

// ---- accessibility (axe) ------------------------------------------------------------------------
const serious = ok.flatMap((p) => (p.axe ?? []).filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${new URL(p.url).pathname}: [${v.impact}] ${v.id} (${v.count}×) ${v.targets.slice(0, 2).join(" | ")}`));
const lesser = ok.flatMap((p) => (p.axe ?? []).filter((v) => !["serious", "critical"].includes(v.impact)).map((v) => `${new URL(p.url).pathname}: [${v.impact}] ${v.id}`));
R.add("a11y.axe", "axe-core WCAG 2.1 AA: zero serious/critical", serious.length ? FAIL : PASS,
  [`${ok.length} page(s) scanned (tags wcag2a, wcag2aa, wcag21a, wcag21aa)`, ...(serious.length ? serious.slice(0, 15) : ["0 serious or critical"]), lesser.length ? `minor/moderate (listed, not blocking): ${lesser.slice(0, 6).join("; ")}` : ""], "Fix each listed violation; axe.json has the selectors and help links.");

// ---- screenshots + layout ---------------------------------------------------------------------
const overflow = ok.filter((p) => p.overflow375).map((p) => new URL(p.url).pathname);
const shotsOk = ok.every((p) => p.shots?.[375] && p.shots?.[768] && p.shots?.[1280]);
R.add("shots.breakpoints", "Screenshots at 375 / 768 / 1280, no sideways scroll at 375", !shotsOk ? FAIL : overflow.length ? FAIL : PASS,
  [`${ok.length * 3} screenshots in ${shotDir}`, overflow.length ? `horizontal overflow at 375 px: ${overflow.join(", ")}` : "no horizontal overflow at 375 px"], "Find the element wider than the viewport at 375 px (often an image, table or long word) and constrain it.");

// ---- legal ----------------------------------------------------------------------------------
const noPrivacy = ok.filter((p) => !p.facts.privacyLink).map((p) => new URL(p.url).pathname);
let privacyTarget = null;
const pl = ok.find((p) => p.facts.privacyLink)?.facts.privacyLink;
if (pl) privacyTarget = await fetch(new URL(pl.href, origin), { headers: { "user-agent": UA, ...(authHeader ? { authorization: authHeader } : {}) }, signal: AbortSignal.timeout(20_000) }).then((r) => r.status).catch(() => 0);
R.add("legal.privacy", "Privacy policy linked from every page", noPrivacy.length || !pl || !(privacyTarget >= 200 && privacyTarget < 400) ? FAIL : PASS,
  [noPrivacy.length ? `no privacy link on: ${noPrivacy.join(", ")}` : `privacy link on all ${ok.length} page(s)`, pl ? `${pl.href} → HTTP ${privacyTarget}` : "no privacy page found"], "Link the privacy page from the footer of every page.");
if (isProd) {
  const terms = ok.find((p) => p.facts.termsLink)?.facts.termsLink;
  R.add("legal.terms", "Terms page", terms ? PASS : UNVERIFIED, terms ? `linked: ${terms.href}` : "no terms page linked", "Decide whether this site needs terms (v2 standard); if yes, add and link them.");
} else na("legal.terms", "Terms page", "checked in production mode");

// ---- consent + tracking -------------------------------------------------------------------------
if (isPreview) {
  for (const [id, t] of [["legal.consent", "Cookie consent before non-essential scripts"], ["track.analytics", "Analytics observed firing"], ["track.calls", "Call tracking observed firing"]]) na(id, t, "not applicable to a prospect preview");
} else {
  log("consent + tracking");
  const tr = await observeTracking(browser, startUrl, { credentials });
  writeFileSync(join(out, "tracking.json"), JSON.stringify(tr, null, 2));
  const installed = { analytics: detect(ok.map((p) => p.html).join("\n"), "analytics"), calls: detect(ok.map((p) => p.html).join("\n"), "callTracking") };
  if (tr.error) R.add("legal.consent", "Cookie consent before non-essential scripts", UNVERIFIED, tr.error, "Re-run; the page didn't load for the consent check.");
  else if (tr.beforeConsent.length) R.add("legal.consent", "Cookie consent before non-essential scripts", FAIL, [`${tr.beforeConsent.length} non-essential request(s) before any consent:`, ...tr.beforeConsent.slice(0, 5)], "Load these scripts only after the visitor accepts (consent mode / a gate like the starter's Analytics component).");
  else if (!tr.afterConsent.length && !installed.analytics.length && !installed.calls.length) na("legal.consent", "Cookie consent before non-essential scripts", "no non-essential script loads, before or after consent (tracking.json)");
  else R.add("legal.consent", "Cookie consent before non-essential scripts", tr.banner ? PASS : FAIL, [tr.banner ? `nothing non-essential before consent; banner button "${tr.banner}"` : "non-essential scripts present but no consent banner found", ...tr.afterConsent.slice(0, 3)], "Show a consent banner and load the scripts only after yes.");
  const fire = (id, title, hits, inst) => R.add(id, title, hits.length ? PASS : inst.length ? FAIL : UNVERIFIED,
    hits.length ? hits.slice(0, 4) : inst.length ? `${inst.join(", ")} installed but no request seen${tr.banner ? " after accepting" : ""}` : "none installed, none observed in network requests",
    inst.length ? "It's installed but not firing: check the ID, the consent gate and the tag." : "Install and verify live, or confirm with the client that this site has none.");
  fire("track.analytics", "Analytics observed firing (network)", tr.analyticsHits, installed.analytics);
  fire("track.calls", "Call tracking observed firing (network)", tr.callTrackingHits, installed.calls);
}

// ---- performance ------------------------------------------------------------------------------
const formPage = pickFormPage(ok);
if (isPreview) na("perf.lighthouse", "Lighthouse mobile performance ≥ 90", "not gated on a prospect preview");
else {
  const lhPages = [...new Set([startUrl, formPage?.url].filter(Boolean))];
  const ev = [], low = [];
  for (const [i, u] of lhPages.entries()) {
    log(`lighthouse ${u}`);
    const r = await runLighthouse(u, { jsonPath: join(out, `lighthouse-${i}.json`), extraHeaders: authHeader ? { authorization: authHeader } : undefined });
    if (r.error || r.runtimeError) { ev.push(`${u}: ${r.error ?? r.runtimeError}`); low.push(null); continue; }
    ev.push(`${new URL(u).pathname}: performance ${r.performance} (mobile) · accessibility ${r.accessibility} · best practices ${r.bestPractices} · SEO ${r.seo}${r.lcpMs ? ` · LCP ${(r.lcpMs / 1000).toFixed(1)} s` : ""}`);
    if (r.performance < 90) low.push(`${new URL(u).pathname} ${r.performance}${r.opportunities.length ? ` (${r.opportunities.join("; ")})` : ""}`);
  }
  R.add("perf.lighthouse", "Lighthouse mobile performance ≥ 90", low.includes(null) ? UNVERIFIED : low.length ? FAIL : PASS, [...ev, ...low.filter(Boolean).map((l) => `below 90: ${l}`)], "Fix the listed Lighthouse opportunities (images, JS, fonts) until mobile performance is 90+.");
}

// ---- forms ----------------------------------------------------------------------------------------
const dest = detectDestination(repo);
const lead = testLead(runId);
let endpoint = dest?.endpoint ?? null;
if (isPreview) {
  na("form.e2e", "Form end to end", "a preview must not take leads (see preview.form)");
  for (const id of ["form.guards", "form.caps", "form.followup"]) na(id, id, "not applicable to a prospect preview");
} else if (!formPage) {
  for (const id of ["form.e2e", "form.guards", "form.caps"]) R.add(id, id === "form.e2e" ? "Form end to end" : id, UNVERIFIED, "no lead form found on the crawled pages", "If the site has a form, point qa-site at it; if the phone is the only action, confirm that with the client.");
} else {
  const confirmLead = opt("--confirm-lead");
  if (confirmLead) {
    const r = dest ? await confirmArrival(dest, repo, { email: confirmLead, sinceIso: startedAt, local: opt("--d1-local") }) : { ok: null, evidence: "no --repo with a known form destination" };
    R.add("form.e2e", "Form end to end: test lead reached its destination", r.ok === true ? PASS : r.ok === false ? FAIL : UNVERIFIED, [`hand-submitted test lead ${confirmLead}`, r.evidence], "Submit the marked test lead again and re-check.");
  } else {
    log(`form test lead ${lead.email} on ${formPage.url}`);
    const s = await submitThroughUi(browser, formPage.url, lead, { credentials });
    endpoint = s.posted?.endpoint ?? endpoint;
    const ev = [`form page ${formPage.url}`, `marked test lead: ${lead.email}`];
    if (s.posted && s.posted.status >= 200 && s.posted.status < 300) {
      const arrival = dest ? await confirmArrival(dest, repo, { email: lead.email, sinceIso: startedAt, local: opt("--d1-local") }) : { ok: null, evidence: "no --repo given: arrival can't be read" };
      R.add("form.e2e", "Form end to end: test lead reached its destination", arrival.ok === true ? PASS : arrival.ok === false ? FAIL : UNVERIFIED,
        [...ev, `POST ${s.posted.endpoint} → ${s.posted.status} ${s.posted.body}`, arrival.evidence], "Check the form's destination (D1 / CRM webhook URL and secret).");
    } else if (s.posted) {
      const captcha = /captcha/i.test(s.posted.body);
      R.add("form.e2e", "Form end to end: test lead reached its destination", captcha && isProd ? UNVERIFIED : FAIL,
        [...ev, `POST ${s.posted.endpoint} → ${s.posted.status} ${s.posted.body}`], captcha ? "Turnstile rejected the automated browser. Submit by hand with the marker email, then re-run with --confirm-lead." : "The endpoint refused or failed the submission: fix the endpoint/config.");
    } else if (s.turnstile) {
      R.add("form.e2e", "Form end to end: test lead reached its destination", isProd ? UNVERIFIED : FAIL,
        [...ev, "no request sent: Turnstile issued no token to the automated browser (Cloudflare flags Playwright as a bot by design)", s.visibleError && `form says: "${s.visibleError}"`],
        isProd ? `Submit the form by hand with email ${lead.email}, name/company "QA TEST, ignore", then: node qa.mjs ${startUrl} --mode production --repo <repo> --confirm-lead ${lead.email}`
          : "Staging should use Turnstile's test keys (sitekey 1x00000000000000000000AA, secret 1x0000000000000000000000000000000AA) so the gate can run end to end.");
    } else {
      R.add("form.e2e", "Form end to end: test lead reached its destination", FAIL, [...ev, `no request sent${s.error ? `: ${s.error}` : ""}`, s.visibleError && `form says: "${s.visibleError}"`], "The form doesn't submit: check the submit handler and endpoint.");
    }
  }
  if (!endpoint) R.add("form.guards", "Form refuses bad requests (no token, foreign origin, oversized)", UNVERIFIED, "form endpoint unknown (no request observed and no --repo)", "Pass --repo so the endpoint is known.");
  else {
    const g = await probeGuards(origin, endpoint, lead);
    const refused = (r) => r.status >= 400 && r.status < 500;
    const gone = [g.noToken, g.badOrigin, g.tooLarge].every((r) => r.status === 404 || r.status === 405);
    R.add("form.guards", "Form refuses bad requests (no token, foreign origin, oversized)", gone ? UNVERIFIED : [g.noToken, g.badOrigin, g.tooLarge].every(refused) ? PASS : FAIL,
      [`POST ${endpoint} without a Turnstile token → ${g.noToken.status} ${g.noToken.body}`, `foreign Origin → ${g.badOrigin.status} ${g.badOrigin.body}`, `30 KB body → ${g.tooLarge.status} ${g.tooLarge.body}`],
      gone ? "The endpoint answers 404/405 to everything (it may not exist), so its guards can't be judged: fix form.e2e first." : "The endpoint must refuse requests without a valid token, from other origins, and oversized bodies.");
  }
  const capsCfg = repo && existsSync(join(repo, "wrangler.toml")) ? (readFileSync(join(repo, "wrangler.toml"), "utf8").match(/^[A-Z_]*(PER_IP_PER_HOUR|PER_DAY)\s*=\s*"?\d+"?/gm) ?? []) : [];
  if (mode === "client-staging" && endpoint) {
    const tries = await probeCaps(origin, endpoint, lead);
    R.add("form.caps", "Rate cap refuses a burst (429)", tries.includes(429) ? PASS : FAIL, [`marked sends to ${endpoint}: ${tries.join(", ")}`, capsCfg.length ? `configured: ${capsCfg.join(", ")}` : ""], "Enforce a per-IP hourly cap and a daily cap on the form endpoint.");
  } else R.add("form.caps", "Rate cap refuses a burst (429)", UNVERIFIED, [capsCfg.length ? `configured: ${capsCfg.join(", ")}` : "no caps found in config",
    isProd ? "not probed live in production (it would spend the real cap)" : "form endpoint unknown, so not probed"], isProd ? "Verified by the client-staging run." : "Pass --repo or fix the form so the endpoint is known.");
}

// ---- tel, meta, SEO, https ---------------------------------------------------------------------
const tels = ok.flatMap((p) => p.facts.telLinks.map((t) => t.href));
const badTel = [...new Set(tels.filter((t) => !telValid(t)))];
R.add("seo.tel", "tel: links present, valid, tappable in the first mobile screen", !tels.length || badTel.length || !home.telAboveFold375 ? FAIL : PASS,
  [`${tels.length} tel: link(s), e.g. ${tels[0] ?? "none"}`, badTel.length ? `invalid: ${badTel.join(", ")}` : "", `tap target in first 375 px screen: ${home.telAboveFold375 ? "yes" : "no"}`], "Every phone number a tel:+1… link; one visible in the mobile header.");
if (isPreview) {
  for (const id of ["seo.meta", "seo.robots", "seo.sitemap", "seo.indexable", "seo.localbusiness", "https.redirect", "legal.terms"]) if (!R.get(id)) na(id, id, "production / staging check");
} else {
  const metaIssues = [];
  const ogImages = new Set();
  for (const p of ok) {
    const f = p.facts, path = new URL(p.url).pathname, miss = [];
    if (!f.title) miss.push("title"); if (!f.metaDesc) miss.push("meta description"); if (!f.ogTitle) miss.push("og:title");
    if (!f.ogImage) miss.push("og:image"); else ogImages.add(new URL(f.ogImage, p.url).href);
    if (!f.canonical) miss.push("canonical"); else if (new URL(f.canonical, p.url).origin !== origin && isProd) miss.push(`canonical points off-site (${f.canonical})`);
    if (miss.length) metaIssues.push(`${path}: missing ${miss.join(", ")}`);
  }
  for (const img of [...ogImages].slice(0, 5)) {
    const s = await fetch(img, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) }).then((r) => r.status).catch(() => 0);
    if (s !== 200) metaIssues.push(`og:image ${img} → ${s || "no response"}`);
  }
  R.add("seo.meta", "Title, description, og:title, og:image (loads), canonical on every page", metaIssues.length ? FAIL : PASS, metaIssues.length ? metaIssues.slice(0, 12) : `all ${ok.length} page(s) complete; og:image(s) load: ${[...ogImages].join(", ")}`, "Add the missing tags per page.");
  const rb = await robotsTxt(origin, { allowLocal });
  R.add("seo.robots", "robots.txt answers and doesn't block everything", isProd ? (rb.ok && !rb.data?.disallowAll ? PASS : FAIL) : rb.ok ? PASS : FAIL, rb.evidence, "Serve robots.txt; in production it must not Disallow: / for all agents.");
  const smUrls = sm?.data?.urls ?? [];
  const offsite = smUrls.filter((u) => { try { return new URL(u).origin !== origin; } catch { return true; } });
  R.add("seo.sitemap", "sitemap.xml answers with same-origin URLs", sm?.ok && !(isProd && offsite.length) ? PASS : FAIL, [sm?.evidence ?? "not fetched", offsite.length ? `${offsite.length} URL(s) not on ${origin}, e.g. ${offsite[0]}` : ""], "Serve sitemap.xml listing this origin's pages.");
  const noindex = ok.filter((p) => /noindex/i.test(p.facts.robotsMeta) || /noindex/i.test(p.headers?.["x-robots-tag"] ?? "")).map((p) => new URL(p.url).pathname);
  if (isProd) R.add("seo.indexable", "Production pages are indexable (no noindex)", noindex.length ? FAIL : PASS, noindex.length ? `noindex on: ${noindex.join(", ")}` : `no noindex on ${ok.length} page(s)`, "Remove noindex (meta robots / X-Robots-Tag) from production.");
  else na("seo.indexable", "Production pages are indexable", `staging: ${noindex.length ? "noindex present (fine for staging)" : "no noindex"}`);
  if (isProd) R.add("seo.localbusiness", "LocalBusiness structured data", home.facts.localBusiness.length ? PASS : FAIL, home.facts.schemaTypes.length ? `schema types: ${home.facts.schemaTypes.join(", ")}` : "no JSON-LD on the home page", "Add LocalBusiness (or HVACBusiness…) JSON-LD with name, phone, address, area served.");
  else na("seo.localbusiness", "LocalBusiness structured data", "checked in production mode");
  if (isProd) {
    const hr = await httpsRedirect(base, { allowLocal });
    const ev = [hr.evidence];
    let wwwOk = true;
    const alt = base.hostname.startsWith("www.") ? base.hostname.slice(4) : `www.${base.hostname}`;
    try {
      const w = await safeGet(`https://${alt}/`, { maxBytes: 20_000, userAgent: UA, allowLocal });
      wwwOk = new URL(w.url).hostname === base.hostname;
      ev.push(`https://${alt}/ → ${w.url}${wwwOk ? "" : " (not redirected to the main host)"}`);
    } catch (e) { ev.push(`https://${alt}/ not served (${e.message})`); }
    R.add("https.redirect", "HTTPS forced; www and non-www resolve to one host", hr.ok === true && wwwOk ? PASS : hr.ok === null ? UNVERIFIED : FAIL, ev, "301 http → https, and 301 the other host form to the main one.");
  } else na("https.redirect", "HTTPS forced; www/non-www consistent", "checked in production mode");
}

// ---- prospect preview -----------------------------------------------------------------------------
if (isPreview) {
  const anon = await fetch(startUrl, { headers: { "user-agent": UA }, redirect: "manual", signal: AbortSignal.timeout(20_000) }).then((r) => ({ status: r.status, robots: r.headers.get("x-robots-tag") ?? "" })).catch((e) => ({ status: 0, robots: "", error: e.message }));
  R.add("preview.access", "Preview needs a password (unlisted / protected)", anon.status === 401 || anon.status === 403 ? PASS : FAIL, `no password → HTTP ${anon.status || anon.error}`, "Set SITE_MODE=mock with MOCK_PASSWORD (or Cloudflare Access) before sharing the link.");
  const missingNoindex = ok.filter((p) => !/noindex/i.test(p.headers?.["x-robots-tag"] ?? "") && !/noindex/i.test(p.facts.robotsMeta)).map((p) => new URL(p.url).pathname);
  const rb = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": UA, ...(authHeader ? { authorization: authHeader } : {}) }, signal: AbortSignal.timeout(20_000) }).then(async (r) => ({ status: r.status, text: await r.text() })).catch(() => ({ status: 0, text: "" }));
  const disallow = /user-agent:\s*\*[\s\S]*?\n\s*disallow:\s*\/\s*(\n|$)/i.test(`${rb.text}\n`);
  R.add("preview.noindex", "Preview is not indexable (noindex on every page, robots Disallow: /)", missingNoindex.length || !disallow ? FAIL : PASS,
    [missingNoindex.length ? `no noindex on: ${missingNoindex.join(", ")}` : `noindex on all ${ok.length} page(s)`, `robots.txt HTTP ${rb.status}${disallow ? ", Disallow: /" : ", does NOT disallow all"}`], "Serve X-Robots-Tag: noindex on every response and robots.txt Disallow: /.");
  const noBanner = ok.filter((p) => !/preview/i.test(p.bannerText ?? "")).map((p) => new URL(p.url).pathname);
  R.add("preview.banner", "PreviewBanner on every page", noBanner.length ? FAIL : PASS, noBanner.length ? `no preview banner on: ${noBanner.join(", ")}` : `banner on all ${ok.length} page(s): "${(home.bannerText ?? "").trim().slice(0, 100)}"`, "Render <PreviewBanner/> in the layout.");
  const fe = dest?.endpoint ?? "/api/lead";
  const fr = await fetch(origin + fe, { method: "POST", headers: { "content-type": "application/json", origin, ...(authHeader ? { authorization: authHeader } : {}) }, body: "{}", signal: AbortSignal.timeout(15_000) }).then((r) => r.status).catch(() => 0);
  R.add("preview.form", "Preview form refuses leads", fr >= 400 || fr === 0 ? PASS : FAIL, `POST ${fe} → ${fr || "no response"}`, "Mock sites must not accept leads.");
} else for (const id of ["preview.access", "preview.noindex", "preview.banner", "preview.form"]) na(id, id, "prospect-preview mode only");

// ---- links + secrets -------------------------------------------------------------------------------
log("links");
const lk = await checkLinks(ok, origin, { allowLocal, auth: authHeader });
R.add("links.broken", "No broken links (internal; external 404/410)", lk.broken.length || lk.extBroken.length ? FAIL : PASS,
  [`${lk.internalChecked} internal, ${lk.externalChecked}/${lk.externalTotal} external checked`, ...lk.broken.slice(0, 10), ...lk.extBroken.slice(0, 10)], "Fix or remove the broken links.");
log("secrets");
const vals = envValues(repo);
const served = [];
for (const p of ok) served.push(...scanText(p.html ?? "", `served ${new URL(p.url).pathname}`, vals));
const assets = [...new Set(ok.flatMap((p) => p.requests.filter((r) => ["script", "stylesheet", "fetch", "xhr"].includes(r.type) && new URL(r.url).origin === origin).map((r) => r.url)))].slice(0, 80);
for (const a of assets) {
  const t = await fetch(a, { headers: { "user-agent": UA, ...(authHeader ? { authorization: authHeader } : {}) }, signal: AbortSignal.timeout(20_000) }).then((r) => r.text()).catch(() => "");
  served.push(...scanText(t, `served ${new URL(a).pathname}`, vals));
}
const build = repo ? scanBuild(repo, vals) : null;
const allHits = [...served, ...(build?.hits ?? [])];
R.add("secrets.output", "No secrets or env values in the built output", allHits.length ? FAIL : repo && build ? PASS : UNVERIFIED,
  [`served: ${ok.length} page(s) + ${assets.length} asset(s) scanned`, build ? `build dir ${build.dir}: ${build.scanned} file(s) scanned, compared with ${vals.length} env value(s)` : repo ? "no build dir (out/, dist/) in the repo: run the build first" : "no --repo: the build output wasn't scanned", ...allHits.slice(0, 10)],
  allHits.length ? "Remove the secret from client code, rotate it, rebuild." : "Re-run with --repo after building, so the build output is scanned too.");

// ---- human items -------------------------------------------------------------------------------------
for (const [id, [title, how]] of Object.entries(HUMAN)) {
  if (isPreview && id !== "a11y.keyboard") { na(id, title, "not applicable to a prospect preview"); continue; }
  if (id === "gbp" && !isProd) { na(id, title, "checked in production mode"); continue; }
  if (id === "form.followup" && R.get("form.followup")?.status === NA) continue;
  R.add(id, title, confirms[id] ? PASS : UNVERIFIED, confirms[id] ? `confirmed by the operator: ${confirms[id]}` : "needs a human; never assumed", how);
}

// ---- write ------------------------------------------------------------------------------------------
await browser.close();
writeFileSync(join(out, "network.json"), JSON.stringify(pages.map((p) => ({ url: p.url, status: p.status, requests: p.requests })), null, 2));
writeFileSync(join(out, "axe.json"), JSON.stringify(pages.map((p) => ({ url: p.url, violations: p.axe ?? [] })), null, 2));
const v = writeReport(out, {
  url: startUrl, mode, startedAt, finishedAt: new Date().toISOString(), results: R, repo,
  artifacts: { report: join(out, "report.md"), checks: join(out, "checks.json"), screenshots: shotDir, network: join(out, "network.json"), axe: join(out, "axe.json") },
});
console.log(`${v.line}\n${join(out, "report.md")}`);
process.exit(v.exit);

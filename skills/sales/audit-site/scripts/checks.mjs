#!/usr/bin/env node
/**
 * Automated checks for the audit-site skill. No dependencies (Node 20+).
 *
 *   node checks.mjs <url> [--out <dir>]
 *     → <dir>/checks.json, <dir>/page.txt, <dir>/screenshot.jpg (when PageSpeed returns one)
 *
 * Env: PSI_API_KEY (optional; PageSpeed Insights works without one at low volume)
 *
 * Standards and offer mapping: ../references/audit-checklist.md
 * Only public http(s) sites on ports 80/443 are fetched. Private, loopback and
 * link-local addresses are refused at every redirect hop.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Shared with qa-site: safe fetch (SSRF guard), HTML helpers, vendor detection, page facts.
import { assertPublicUrl, safeGet } from "../../../_shared/site-checks/fetch.mjs";
import { PHONE_RE, blocks, decode, has, tags, textOf } from "../../../_shared/site-checks/html.mjs";
import { detect } from "../../../_shared/site-checks/detect.mjs";
import { parsePage } from "../../../_shared/site-checks/page-checks.mjs";

export { assertPublicUrl, safeGet };

const YEAR = new Date().getFullYear();

const CITIES = ["Saskatoon", "Regina", "Prince Albert", "Moose Jaw", "Swift Current", "Yorkton", "North Battleford", "Estevan", "Weyburn",
  "Lloydminster", "Martensville", "Warman", "Humboldt", "Melfort", "Kindersley", "Calgary", "Edmonton", "Red Deer", "Lethbridge",
  "Medicine Hat", "Grande Prairie", "Airdrie", "Spruce Grove", "St. Albert", "Okotoks", "Fort McMurray", "Leduc", "Cochrane",
  "Camrose", "Sherwood Park", "Winnipeg", "Brandon", "Steinbach", "Thompson", "Portage la Prairie", "Selkirk", "Winkler", "Morden", "Dauphin"];
const FILLER = [/trusted local experts?/i, /take pride in (our|every)/i, /customer satisfaction is our/i, /serving the community for years/i,
  /second to none/i, /one[- ]stop shop/i, /quality (work|service) at (an )?affordable price/i, /no job (is )?too (big|small)/i,
  /your satisfaction is (our|guaranteed)/i, /best in the business/i, /top[- ]notch/i, /state[- ]of[- ]the[- ]art/i];

// ---- PageSpeed Insights ---------------------------------------------------------
async function pagespeed(url, key) {
  const q = new URLSearchParams({ url, strategy: "mobile" });
  for (const c of ["PERFORMANCE", "ACCESSIBILITY", "SEO", "BEST_PRACTICES"]) q.append("category", c);
  if (key) q.set("key", key);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`PageSpeed HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const lr = (await res.json()).lighthouseResult ?? {};
  const cat = (k) => (lr.categories?.[k]?.score == null ? null : Math.round(lr.categories[k].score * 100));
  const a = lr.audits ?? {};
  const num = (k) => a[k]?.numericValue ?? null;
  const failing = (catKey) => (lr.categories?.[catKey]?.auditRefs ?? [])
    .map((r) => a[r.id]).filter((x) => x && x.score === 0 && x.scoreDisplayMode === "binary").map((x) => x.title);
  return {
    scores: { performance: cat("performance"), accessibility: cat("accessibility"), seo: cat("seo"), bestPractices: cat("best-practices") },
    metrics: { fcpMs: num("first-contentful-paint"), lcpMs: num("largest-contentful-paint"), cls: num("cumulative-layout-shift"), tbtMs: num("total-blocking-time"), bytes: num("total-byte-weight") },
    failingA11y: failing("accessibility"),
    screenshot: a["final-screenshot"]?.details?.data ?? null,
  };
}

// ---- the checks -------------------------------------------------------------------
export async function runChecks(input, { outDir, psiKey = process.env.PSI_API_KEY, onProgress = () => {} } = {}) {
  const startUrl = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  onProgress("fetching homepage");
  const home = await safeGet(startUrl);
  if (home.status >= 400) throw new Error(`homepage returned HTTP ${home.status}`);
  const html = home.text;
  const base = new URL(home.url);
  const origin = base.origin;

  onProgress("PageSpeed (mobile), up to 2 minutes");
  const [psiR, robotsR, sitemapR, httpR] = await Promise.allSettled([
    pagespeed(home.url, psiKey),
    safeGet(`${origin}/robots.txt`, { maxBytes: 200_000 }),
    safeGet(`${origin}/sitemap.xml`, { maxBytes: 500_000 }),
    base.protocol === "https:" ? safeGet(`http://${base.host}/`, { maxBytes: 50_000 }) : Promise.reject(new Error("site is http")),
  ]);
  const psi = psiR.status === "fulfilled" ? psiR.value : null;
  const psiError = psiR.status === "rejected" ? String(psiR.reason?.message ?? psiR.reason) : null;
  onProgress("analysing");

  const text = textOf(html);
  const lower = text.toLowerCase();
  const page = parsePage(html);
  const { head, scriptSrcs, links, aBlocks, title, metas, metaDesc, viewport, ogSite, h1s, htmlLang, ldjson, schemaTypes } = page;
  const hay = html; // detection runs over raw HTML: script srcs, inline config, class names
  const buttons = [...blocks(html, "button").map((b) => textOf(b.inner)), ...tags(html, "input").filter((t) => /submit|button/i.test(t.type ?? "")).map((t) => t.value ?? "")];
  const imgs = tags(html, "img");
  const forms = blocks(html, "form");
  const iframes = tags(html, "iframe").map((t) => t.src ?? "");

  // Phones
  const telLinks = links.filter((l) => /^tel:/i.test(l.href));
  const phones = [...new Set([...text.matchAll(PHONE_RE)].map((m) => `(${m[1]}) ${m[2]}-${m[3]}`))];
  const firstScreen = text.slice(0, 700);   // rough first mobile screen: header + hero
  const headerHtml = (html.match(/<header\b[\s\S]*?<\/header>/i) ?? [""])[0];
  const phoneEarly = PHONE_RE.test(firstScreen) || /href=["']tel:/i.test(headerHtml);
  PHONE_RE.lastIndex = 0;

  // Forms
  const visibleFields = (inner) => [
    ...tags(inner, "input").filter((t) => !/^(hidden|submit|button|image|reset)$/i.test(t.type ?? "text")),
    ...tags(inner, "textarea"), ...tags(inner, "select"),
  ].filter((t) => !/(g-recaptcha|cf-turnstile|honeypot|hp_|bot)/i.test(`${t.name ?? ""} ${t.class ?? ""} ${t.id ?? ""}`) && !("hidden" in t) && !/display:\s*none/i.test(t.style ?? ""));
  const realForms = forms.map((f) => ({ ...f, fields: visibleFields(f.inner) })).filter((f) => f.fields.length > 0 && !/search/i.test(`${f.attrs.role ?? ""} ${f.attrs.class ?? ""} ${f.attrs.action ?? ""}`));
  const mainForm = realForms.sort((a, b) => b.fields.length - a.fields.length)[0];
  const formIframe = iframes.find((s) => /leadconnectorhq|msgsndr|jotform|typeform|wufoo|hsforms|google\.com\/forms|formstack|cognitoforms|getjobber|housecallpro/i.test(s));
  const labelled = (inner, f) => {
    if (f["aria-label"] || f["aria-labelledby"] || f.title) return true;
    if (f.id && new RegExp(`<label[^>]+for=["']${f.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i").test(inner)) return true;
    return false; // placeholders don't count as labels (WCAG)
  };

  const ctaWords = /\b(call|quote|estimate|book|schedule|request|get (a|my|your)|contact us|free)\b/i;
  const ctaEarly = aBlocks.slice(0, 40).some((a) => ctaWords.test(a.text) && a.text.length < 40 && text.indexOf(a.text) > -1 && text.indexOf(a.text) < 900) ||
    buttons.some((b) => ctaWords.test(b) && text.indexOf(b) > -1 && text.indexOf(b) < 900);

  const found = {
    analytics: detect(hay, "analytics"), consent: detect(hay, "consent"), callTracking: detect(hay, "callTracking"), fsm: detect(hay, "fsm"),
    crm: detect(hay, "crm"), booking: detect(hay, "booking"), chat: detect(hay, "chat"), reviews: detect(hay, "reviews"),
    carousel: detect(hay, "carousel"), builder: detect(hay, "builder"),
  };
  const channels = [telLinks.length && "phone", (mainForm || formIframe) && "form", found.booking.length && "booking", found.chat.length && "chat"].filter(Boolean);

  const cityCounts = CITIES.map((c) => [c, (text.match(new RegExp(`\\b${c.replace(".", "\\.")}\\b`, "gi")) ?? []).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const tradeScore = {
    hvac: (lower.match(/furnace|hvac|heating|air condition|\bac\b|heat pump|boiler|ductwork/g) ?? []).length,
    plumbing: (lower.match(/plumb|drain|sewer|water heater|faucet|toilet|leak/g) ?? []).length,
    electrical: (lower.match(/electric|wiring|panel upgrade|breaker|outlet|generator|ev charger/g) ?? []).length,
  };
  const trade = Object.entries(tradeScore).sort((a, b) => b[1] - a[1])[0];
  const fillerHits = [...new Set(FILLER.flatMap((re) => (text.match(new RegExp(re.source, "gi")) ?? [])))];
  const years = [...text.matchAll(/©\s*(?:copyright\s*)?(\d{4})|copyright\s*(?:©\s*)?(\d{4})/gi)].map((m) => Number(m[1] ?? m[2]));
  const footerYear = years.length ? Math.max(...years) : null;
  const imgExt = imgs.map((i) => (i.src ?? i["data-src"] ?? "").split("?")[0].split(".").pop()?.toLowerCase());
  const legacyImgs = imgExt.filter((e) => ["jpg", "jpeg", "png"].includes(e)).length;
  const modernImgs = imgExt.filter((e) => ["webp", "avif"].includes(e)).length + (/<picture\b[\s\S]*?type=["']image\/(webp|avif)/i.test(html) ? 1 : 0);
  const autoplayVideos = tags(html, "video").filter((v) => "autoplay" in v && !("muted" in v)).length +
    iframes.filter((s) => /autoplay=1/.test(s) && !/mute=1/.test(s)).length;

  const checks = [];
  const add = (id, group, title, status, evidence, fix, offer) => checks.push({ id, group, title, status, evidence, fix: status === "pass" ? "" : fix, offer });
  const psiOr = (v, fn) => (psi && v != null ? fn(v) : null);

  // Conversion
  add("tel-link", "conversion", "Click-to-call link", telLinks.length ? "pass" : "fail",
    telLinks.length ? `${telLinks.length} tel: link(s), e.g. ${telLinks[0].href}` : phones.length ? `Phone shown as text (${phones[0]}) but not tappable` : "No phone number found on the homepage",
    "Make every phone number a tel: link; on mobile, a Call button in the header.", "L1");
  add("phone-above-fold", "conversion", "Phone in the first mobile screen", phoneEarly ? "pass" : "fail",
    phoneEarly ? "Phone or tel: link in the header or first ~700 characters of text (script guess; confirm with screenshot)" : "No phone in the header or opening text (script guess; confirm with screenshot)",
    "Put the phone number in the header, visible without scrolling on a phone.", "L1");
  add("cta-above-fold", "conversion", "One clear action in the first screen", ctaEarly ? "pass" : "warn",
    ctaEarly ? "An action link or button (call, quote, book) appears in the opening content (script guess)" : "No call/quote/book button found in the opening content (script guess)",
    "One primary button in the hero that states the outcome, e.g. \"Call for a same-day visit\".", "L1");
  add("competing-ctas", "conversion", "One primary action, not several", channels.length >= 3 ? "warn" : "pass",
    `Contact channels found: ${channels.join(", ") || "none"}${found.chat.length ? ` (chat: ${found.chat.join(", ")})` : ""}`,
    "Pick one primary action and make the others visually secondary.", "L1");
  if (mainForm) add("form-fields", "conversion", "Short primary form (≤5 fields)", mainForm.fields.length <= 5 ? "pass" : "fail",
    `Largest form has ${mainForm.fields.length} visible fields: ${mainForm.fields.map((f) => f.name || f.id || f.type || "field").slice(0, 10).join(", ")}`,
    "Cut to name, phone, service needed, short message.", "L1");
  else if (formIframe) add("form-fields", "conversion", "Short primary form (≤5 fields)", "unverified", `Form is embedded in an iframe (${new URL(formIframe, origin).host}); fields not counted`, "Check the embedded form by hand.", "L1");
  else add("form-fields", "conversion", "Short primary form (≤5 fields)", "info", "No form on the homepage", "Fine if the phone is the primary action; otherwise add a short request form.", "L1");
  const weakCta = [...buttons, ...aBlocks.map((a) => a.text)].map((s) => s.trim()).filter((s) => /^(submit|send|learn more|read more|click here)$/i.test(s));
  add("cta-copy", "conversion", "Buttons state the outcome", weakCta.length ? "warn" : "pass",
    weakCta.length ? `Found: ${[...new Set(weakCta)].map((s) => `"${s}"`).join(", ")}` : "No \"Submit\" / \"Learn more\" buttons",
    "Rewrite as action + benefit: \"Get my free quote\", \"Book a same-day call\".", "L1");
  add("carousel-hero", "conversion", "No carousel in the hero", found.carousel.length ? "warn" : "pass",
    found.carousel.length ? `Slider code found: ${found.carousel.join(", ")}` : "No slider library found",
    "Replace the slider with one headline and one image.", "L1");
  add("autoplay-sound", "conversion", "No autoplay video with sound", autoplayVideos ? "fail" : "pass",
    autoplayVideos ? `${autoplayVideos} autoplaying video(s) without mute` : "None", "Mute autoplay video or remove it.", "L1");

  // Trust
  const reviewText = /\b(testimonials?|reviews?|what (our )?(customers|clients) say|★|5[- ]star|rated \d)/i.test(text);
  add("reviews-on-site", "trust", "Reviews or testimonials on the homepage", reviewText || found.reviews.length ? "pass" : "fail",
    found.reviews.length ? `Review widget: ${found.reviews.join(", ")}` : reviewText ? "Review/testimonial wording found in page text" : "No reviews, testimonials or review widget found",
    "Add 3 real, attributed Google reviews near the top; set up review requests so the count grows.", "L1 + Core: review requests");
  const lic = text.match(/\b(licen[cs]ed|insured|bonded|certified|TSASK|SaskPower|red seal|WCB|COR certified|journeyman)\b/i);
  add("license-insured", "trust", "Licence, insurance or certification named", lic ? "pass" : "warn",
    lic ? `Found "${lic[0]}"` : "No licence/insurance wording found", "Name the licence and insurance, with the number if they'll show it.", "L1");
  const yrs = text.match(/\b(since|est\.?|established)\s*(19|20)\d{2}\b|\b\d{1,3}\+?\s+years\b/i);
  add("years-in-business", "trust", "Years in business stated as a number", yrs ? "pass" : "warn",
    yrs ? `Found "${yrs[0]}"` : "No founding year or years-in-business number", "State the actual number of years.", "L1");
  add("filler-copy", "trust", "No generic filler copy", fillerHits.length ? "warn" : "pass",
    fillerHits.length ? `Found: ${fillerHits.map((s) => `"${s}"`).join(", ")}` : "None of the filler phrases found",
    "Replace with specific claims the owner can back up (copy-formulas.md).", "L1");
  if (footerYear) add("copyright-stale", "trust", "Footer year is current", footerYear >= YEAR - 1 ? "pass" : "info",
    `Footer says © ${footerYear}`, "Conversation opener only: the site hasn't been touched in a while.", "L1");

  // Speed
  if (psi) {
    const p = psi.scores.performance, lcp = psi.metrics.lcpMs, cls = psi.metrics.cls;
    add("psi-performance", "speed", "Mobile performance 90+", p >= 90 ? "pass" : p >= 50 ? "warn" : "fail", `Lighthouse mobile performance ${p} (measured)`, "Compress and resize images, cut third-party scripts, static hosting.", "L1");
    if (lcp != null) add("lcp", "speed", "Largest content paints in ≤2.5 s", lcp <= 2500 ? "pass" : lcp <= 4000 ? "warn" : "fail", `LCP ${(lcp / 1000).toFixed(1)} s on mobile (measured)`, "Serve a smaller hero image and preload it.", "L1");
    if (cls != null) add("cls", "speed", "Layout doesn't jump (CLS ≤0.1)", cls <= 0.1 ? "pass" : cls <= 0.25 ? "warn" : "fail", `CLS ${cls.toFixed(2)} (measured)`, "Set width/height on images and embeds.", "L1");
  } else add("psi-performance", "speed", "Mobile performance 90+", "unverified", `PageSpeed failed: ${psiError}`, "Re-run, or run Lighthouse by hand.", "L1");
  if (imgs.length >= 3) add("image-formats", "speed", "Modern image formats", modernImgs ? "pass" : legacyImgs ? "warn" : "info",
    `${imgs.length} images; ${legacyImgs} JPG/PNG, ${modernImgs} WebP/AVIF`, "Serve WebP/AVIF with explicit sizes.", "L1");
  const lazy = imgs.filter((i) => (i.loading ?? "").toLowerCase() === "lazy" || "data-src" in i || "data-lazy-src" in i).length;
  if (imgs.length > 4) add("lazy-images", "speed", "Below-the-fold images lazy-loaded", lazy ? "pass" : "warn", `${lazy} of ${imgs.length} images lazy`, "Add loading=\"lazy\" below the first screen.", "L1");

  // Accessibility
  if (psi) {
    const a = psi.scores.accessibility;
    add("psi-accessibility", "accessibility", "Accessibility 90+ (WCAG 2.1 AA floor)", a >= 90 ? "pass" : a >= 70 ? "warn" : "fail",
      `Lighthouse accessibility ${a} (measured)${psi.failingA11y.length ? `. Failing: ${psi.failingA11y.slice(0, 6).join("; ")}` : ""}`, "Fix the failing audits listed.", "L1");
  } else add("psi-accessibility", "accessibility", "Accessibility 90+ (WCAG 2.1 AA floor)", "unverified", "PageSpeed unavailable", "Run Lighthouse or axe by hand.", "L1");
  add("html-lang", "accessibility", "Page language set", /\blang=/i.test(htmlLang) ? "pass" : "fail", /\blang=/i.test(htmlLang) ? `<html${htmlLang}>`.slice(0, 80) : "No lang attribute on <html>", "Add lang=\"en-CA\".", "L1");
  const noAlt = imgs.filter((i) => !("alt" in i)).length;
  if (imgs.length) add("img-alt", "accessibility", "Images have alt text", noAlt ? "fail" : "pass", `${noAlt} of ${imgs.length} images have no alt attribute`, "Write alt text that describes the content.", "L1");
  if (mainForm) {
    const unl = mainForm.fields.filter((f) => !labelled(html, f)).length;
    add("form-labels", "accessibility", "Form fields have labels", unl ? "warn" : "pass", `${unl} of ${mainForm.fields.length} fields without a label or aria-label (placeholders don't count)`, "Add visible <label for> to each field.", "L1");
  }

  // Local SEO
  const httpRedirects = httpR.status === "fulfilled" && httpR.value.url.startsWith("https:");
  add("https", "local-seo", "HTTPS, and http redirects to it", base.protocol === "https:" && (httpRedirects || httpR.status === "rejected") ? "pass" : "fail",
    base.protocol !== "https:" ? "Site serves over plain http" : httpRedirects ? "https, http redirects" : "https works, but http:// did not redirect to https", "Force HTTPS with a 301.", "L1");
  add("viewport", "local-seo", "Mobile viewport set", viewport ? "pass" : "fail", viewport ? `viewport: ${viewport}` : "No viewport meta: the page renders as desktop on phones", "Add a responsive viewport meta and layout.", "L1");
  const titleLocal = title && (CITIES.some((c) => title.includes(c)) || /furnace|hvac|heating|cooling|plumb|drain|electric/i.test(title));
  add("title-tag", "local-seo", "Title names the service or city", !title ? "fail" : titleLocal ? "pass" : "warn", title ? `"${title.slice(0, 90)}"` : "No <title>", "Title as \"Service in City | Business name\".", "Local SEO");
  add("meta-description", "local-seo", "Meta description", metaDesc ? "pass" : "fail", metaDesc ? `"${metaDesc.slice(0, 120)}"` : "None", "Write one: service, area, the one reason to call.", "Local SEO");
  add("h1", "local-seo", "Exactly one H1", h1s.length === 1 ? "pass" : h1s.length ? "warn" : "fail", h1s.length ? `${h1s.length} H1: ${h1s.slice(0, 3).map((h) => `"${h.slice(0, 60)}"`).join(", ")}` : "No H1", "One H1: the hero headline.", "L1");
  add("city-mentioned", "local-seo", "City or town named on the homepage", cityCounts.length ? "pass" : "warn", cityCounts.length ? `Mentions: ${cityCounts.slice(0, 4).map(([c, n]) => `${c} ×${n}`).join(", ")}` : "No prairie city or town found", "Name the service area in the hero and a service-area section.", "Local SEO");
  const localSchema = schemaTypes.filter((t) => /LocalBusiness|HVACBusiness|Plumber|Electrician|HomeAndConstructionBusiness|RoofingContractor|GeneralContractor|ProfessionalService/i.test(t));
  add("localbusiness-schema", "local-seo", "LocalBusiness structured data", localSchema.length ? "pass" : "warn", schemaTypes.length ? `Schema types: ${schemaTypes.slice(0, 6).join(", ")}` : "No JSON-LD found", "Add HVACBusiness/Plumber/Electrician JSON-LD with NAP matching the GBP.", "Local SEO");
  add("sitemap", "local-seo", "sitemap.xml responds", sitemapR.status === "fulfilled" && sitemapR.value.status === 200 && /<(urlset|sitemapindex)/i.test(sitemapR.value.text) ? "pass" : "warn", sitemapR.status === "fulfilled" ? `HTTP ${sitemapR.value.status}` : String(sitemapR.reason?.message), "Publish a sitemap and submit it in Search Console.", "Local SEO");
  add("robots", "local-seo", "robots.txt responds", robotsR.status === "fulfilled" && robotsR.value.status === 200 ? "pass" : "warn", robotsR.status === "fulfilled" ? `HTTP ${robotsR.value.status}` : String(robotsR.reason?.message), "Add robots.txt pointing at the sitemap.", "Local SEO");
  if (psi) add("psi-seo", "local-seo", "Lighthouse SEO 90+", psi.scores.seo >= 90 ? "pass" : "warn", `Lighthouse SEO ${psi.scores.seo} (measured)`, "Fix the Lighthouse SEO audits.", "Local SEO");

  // Compliance
  const privacy = aBlocks.find((a) => /privacy/i.test(a.text) || /privacy/i.test(a.href));
  add("privacy-policy", "compliance", "Privacy policy linked", privacy ? "pass" : "fail", privacy ? `Link: ${privacy.href.slice(0, 100)}` : "No privacy policy link on the homepage", "Publish a privacy policy (PIPEDA) and link it in the footer and by the form.", "L1");
  const tracks = found.analytics;
  add("cookie-consent", "compliance", "Consent before analytics/pixels", !tracks.length ? "info" : found.consent.length ? "pass" : "fail",
    !tracks.length ? "No analytics or pixels detected" : found.consent.length ? `Consent tool: ${found.consent.join(", ")}` : `Tracking (${tracks.join(", ")}) with no consent tool detected`,
    "Add a consent banner that blocks analytics until accepted.", "L1");
  add("analytics", "compliance", "Analytics installed", tracks.length ? "pass" : "warn", tracks.length ? tracks.join(", ") : "None detected: no one can say how many visits become calls", "Install GA4 with consent mode, and track calls and form sends.", "L1 / Core");
  add("call-tracking", "compliance", "Call tracking", found.callTracking.length ? "pass" : "info", found.callTracking.length ? found.callTracking.join(", ") : "None detected", "Call tracking makes missed-call counts measurable for the day-25 report.", "Core");

  // Never miss it (signals)
  const afterHours = text.match(/\b(24 ?\/ ?7|24[- ]?(hours?|hrs?)|emergency|after[- ]hours|evenings and weekends)\b/i);
  const voicemail = text.match(/leave (us )?a (message|voicemail)|we('| wi)ll call you back/i);
  add("after-hours", "automation", "After-hours handling", "info",
    afterHours ? `Claims "${afterHours[0]}"${voicemail ? `; also "${voicemail[0]}"` : ""}. Who picks up at 2 am?` : `No 24/7 claim${voicemail ? `; says "${voicemail[0]}"` : ""}. Calls outside hours likely go to voicemail.`,
    "Missed-call text-back replies within a minute to every unanswered call.", "Core: missed-call text-back");
  add("fsm-software", "automation", "Field-service software", "info", found.fsm.length ? `Detected: ${found.fsm.join(", ")}` : "None detected on the site",
    found.fsm.length ? "Objection prep: \"Keep it. This covers the calls that never become a job in it.\"" : "Ask on the call (discovery Q4).", "Core");
  add("crm-detected", "automation", "CRM already on the site", "info", found.crm.length ? `Detected: ${found.crm.join(", ")}` : "None detected", "If GHL is already there, ask what's switched on.", "Core");
  add("online-booking", "automation", "Online booking", "info", found.booking.length ? `Detected: ${found.booking.join(", ")}` : "No booking widget", "Quote follow-up keeps requests from going cold.", "Core: quote follow-up");
  const quoteForm = /\b(free (quote|estimate)|request (a )?(quote|estimate)|get (a )?(quote|estimate))\b/i.test(text);
  add("quote-form", "automation", "Quote requests", "info", quoteForm ? "Asks for quote/estimate requests" : "No quote/estimate wording", "Quote follow-up sequence stops at the first reply or STOP.", "Core: quote follow-up");
  add("review-widget", "automation", "Review flow", "info", found.reviews.length ? `Review widget: ${found.reviews.join(", ")}` : "No review widget; compare their Google count with the top competitor's",
    "Review requests after each completed job.", "Core: review requests");
  add("site-builder", "automation", "Site platform", "info", found.builder.length ? found.builder.join(", ") : "Not identified", "Rebuild pitch context; \"my nephew does my website\" objection.", "L1");

  // Scores: per group, (pass + ½ warn) / (pass + warn + fail)
  const GROUPS = ["conversion", "trust", "speed", "accessibility", "local-seo", "compliance"];
  const groupScore = Object.fromEntries(GROUPS.map((g) => {
    const cs = checks.filter((c) => c.group === g && ["pass", "warn", "fail"].includes(c.status));
    const s = cs.length ? Math.round((100 * cs.reduce((t, c) => t + (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0)) / cs.length) : null;
    return [g, s];
  }));
  const weights = { conversion: 3, trust: 2, speed: 2, accessibility: 1, "local-seo": 1, compliance: 1 };
  const ws = GROUPS.filter((g) => groupScore[g] != null);
  const overall = ws.length ? Math.round(ws.reduce((t, g) => t + groupScore[g] * weights[g], 0) / ws.reduce((t, g) => t + weights[g], 0)) : null;

  const result = {
    url: startUrl, finalUrl: home.url, redirects: home.hops, fetchedAt: new Date().toISOString(), truncated: home.truncated,
    score: overall, groupScore,
    counts: Object.fromEntries(["fail", "warn", "pass", "info", "unverified"].map((s) => [s, checks.filter((c) => c.status === s).length])),
    signals: {
      company: ogSite || title.split(/[|–—·-]/).map((s) => s.trim()).filter((s) => s && !/^(home|welcome|home ?page|index)$/i.test(s)).pop() || base.hostname.replace(/^www\./, ""),
      tradeGuess: trade[1] > 0 ? trade[0] : null, tradeScore, cityGuess: cityCounts[0]?.[0] ?? null, cities: cityCounts.map(([c]) => c),
      phones, title, metaDescription: metaDesc, h1: h1s, schemaTypes, scriptHosts: [...new Set(scriptSrcs.map((s) => { try { return new URL(s, origin).host; } catch { return null; } }).filter(Boolean))].slice(0, 25),
      detected: found,
    },
    psi: psi ? { scores: psi.scores, metrics: psi.metrics, failingA11y: psi.failingA11y } : { error: psiError },
    checks,
  };

  if (outDir) {
    mkdirSync(outDir, { recursive: true, mode: 0o700 });
    writeFileSync(join(outDir, "checks.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
    writeFileSync(join(outDir, "page.txt"), text.slice(0, 60_000), { mode: 0o600 });
    if (psi?.screenshot?.startsWith("data:image/")) writeFileSync(join(outDir, "screenshot.jpg"), Buffer.from(psi.screenshot.split(",")[1], "base64"), { mode: 0o600 });
  }
  return result;
}

// ---- CLI ----------------------------------------------------------------------------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  const i = args.indexOf("--out");
  if (!url) { console.error("usage: node checks.mjs <url> [--out <dir>]"); process.exit(1); }
  runChecks(url, { outDir: i >= 0 ? resolve(args[i + 1]) : undefined, onProgress: (s) => console.error(`… ${s}`) })
    .then((r) => {
      console.log(`${r.finalUrl}  score ${r.score ?? "n/a"}  ·  ${r.counts.fail} fail, ${r.counts.warn} warn, ${r.counts.pass} pass`);
      for (const c of r.checks.filter((c) => ["fail", "warn", "unverified"].includes(c.status))) console.log(`  ${c.status.padEnd(10)} ${c.id.padEnd(22)} ${c.evidence}`);
    })
    .catch((e) => { console.error(`checks: ${e.message}`); process.exit(1); });
}

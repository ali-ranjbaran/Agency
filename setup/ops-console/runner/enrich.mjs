/**
 * Enrichment from a firm's OWN website only.
 *   - robots.txt respected (token ArkosaLeadResearch); honest user agent with a contact URL
 *   - 1 request every 2 s per domain; max 4 pages: home + contact, about, services (found from home links)
 *   - never submits forms; never opens login / account / cart / checkout / admin pages
 *   - stays on the firm's own host
 * Extracts only what's published: name, phone, city, emails on the page, owner/manager name and
 * title only when stated, services, 24/7 / emergency claims, residential vs commercial signals.
 * Emails are never guessed, generated or SMTP-verified.
 */
import { parse } from "node-html-parser";
import { UA_ENRICH, robotsAllows, sleep } from "./lib.mjs";

export const PER_DOMAIN_DELAY_MS = 2000;
const MAX_PAGES = 4;
const MAX_BYTES = 1_500_000;
const SKIP_PATH = /(log-?in|sign-?in|account|cart|checkout|wp-admin|admin|portal|my-|register|password)/i;
const KINDS = { contact: /contact|reach|get-?in-?touch/i, about: /about|our-?story|team|who-?we-?are/i, services: /services?|what-?we-?do|heating|cooling|furnace/i };

const ROLE = new Set(["info", "office", "service", "services", "admin", "contact", "sales", "hello", "support", "reception", "dispatch", "accounts", "billing", "team", "mail", "inquiries", "enquiries", "help", "estimates", "quotes", "booking", "bookings", "hvac", "general"]);
const FREEMAIL = new Set(["gmail.com", "hotmail.com", "hotmail.ca", "outlook.com", "live.com", "live.ca", "yahoo.com", "yahoo.ca", "icloud.com", "me.com", "aol.com", "protonmail.com", "proton.me", "msn.com"]);
const ISP = new Set(["sasktel.net", "shaw.ca", "telus.net", "rogers.com", "bell.net", "sympatico.ca", "eastlink.ca", "accesscomm.ca"]);
const NOISE = /(sentry|wixpress|example\.com$|domain\.com$|yourdomain|email\.com$|\.png$|\.jpe?g$|\.gif$|\.webp$|\.svg$)/i;

export const SERVICES = {
  hvac: ["furnace", "boiler", "air conditioning", "heat pump", "ductless", "water heater", "hot water tank", "rooftop", "refrigeration", "duct cleaning", "hrv", "geothermal", "fireplace", "in-floor heating", "humidifier"],
};
const RESIDENTIAL = /\b(residential|homeowners?|your home|home comfort|families|family-owned)\b/gi;
const COMMERCIAL = /\b(commercial|industrial|rooftop units?|property manag\w*|businesses|restaurants?|institutional|light commercial)\b/gi;
const CLAIM_247 = /\b(24\s*\/\s*7|24 ?hours?|24-hour|emergency (service|repair|call))\b/i;

/** Phrases that mean "don't send us marketing". Editable list; a hit blocks the contact. */
export const REFUSAL_PHRASES = [
  "no solicitation", "no solicitors", "no unsolicited", "unsolicited email", "unsolicited commercial", "do not contact",
  "do not solicit", "not accept unsolicited", "no marketing", "marketing offers", "no sales calls", "no cold", "please do not email",
];

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})\b/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

export function emailFlags(email) {
  const [local, domain] = email.toLowerCase().split("@");
  const f = [];
  if (ROLE.has(local.replace(/[^a-z]/g, ""))) f.push("role");
  if (FREEMAIL.has(domain)) f.push("freemail");
  if (ISP.has(domain)) f.push("isp");
  return f;
}

/** One polite fetcher per domain. Returns { url, html } or null. */
export function politeFetcher({ delayMs = PER_DOMAIN_DELAY_MS } = {}) {
  const last = new Map();
  return async function get(url) {
    const host = new URL(url).host;
    const wait = (last.get(host) ?? 0) + delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    if (!(await robotsAllows(url, UA_ENRICH))) { last.set(host, Date.now()); return { url, blocked: true }; }
    last.set(host, Date.now());
    try {
      const res = await fetch(url, { headers: { "user-agent": UA_ENRICH, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
      last.set(host, Date.now());
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) return null;
      return { url: res.url, html: new TextDecoder().decode(buf) };
    } catch { return null; }
  };
}

const textOf = (root) => {
  root.querySelectorAll("script, style, noscript, svg").forEach((n) => n.remove());
  return root.structuredText.replace(/[ \t]+/g, " ");
};

function jsonLd(root) {
  const out = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try { const j = JSON.parse(s.text); out.push(...(Array.isArray(j) ? j : j["@graph"] ?? [j])); } catch {}
  }
  return out;
}

/** Picks contact / about / services links from the home page, same host only, never login pages. */
export function pickLinks(root, baseUrl) {
  const base = new URL(baseUrl);
  const found = {};
  for (const a of root.querySelectorAll("a[href]")) {
    let u;
    try { u = new URL(a.getAttribute("href"), base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || u.host !== base.host || SKIP_PATH.test(u.pathname) || /\.(pdf|jpe?g|png|zip|docx?)$/i.test(u.pathname)) continue;
    u.hash = "";
    if (u.href === base.href) continue;
    const label = `${u.pathname} ${a.text}`;
    for (const [kind, re] of Object.entries(KINDS)) if (!found[kind] && re.test(label)) { found[kind] = u.href; break; }
  }
  return [found.contact, found.about, found.services].filter(Boolean);
}

/** Owner / manager name + title, only when the page states it plainly. */
function people(text) {
  const out = [];
  const TITLE = "(Owner(?:\\s*(?:\\/|and|&)\\s*Operator)?|President|General Manager|Office Manager|Service Manager|Operations Manager|Manager|Founder|Co-Founder|Lead Technician)";
  const NAME = "([A-Z][a-z]+(?:\\s[A-Z][a-z]+){1,2})";
  for (const m of text.matchAll(new RegExp(`${TITLE}\\s*[:\\-–]\\s*${NAME}`, "g"))) out.push({ title: m[1], name: m[2] });
  for (const m of text.matchAll(new RegExp(`${NAME}\\s*[,\\-–]\\s*${TITLE}`, "g"))) out.push({ name: m[1], title: m[2] });
  return out.filter((p) => !/^(Call|Contact|Email|Our|The)\b/.test(p.name));
}

export async function enrichSite(website, { trade = "hvac", city = "Saskatoon", fetcher = politeFetcher() } = {}) {
  const homeUrl = /^https?:\/\//.test(website) ? website : `https://${website}`;
  const pages = [];
  const home = await fetcher(homeUrl);
  if (!home || home.blocked) return { ok: false, error: home?.blocked ? "robots_disallowed" : "unreachable", pages: [] };
  pages.push(home);
  for (const u of pickLinks(parse(home.html), home.url).slice(0, MAX_PAGES - 1)) {
    const p = await fetcher(u);
    if (p && !p.blocked) pages.push(p);
  }

  const emails = new Map(); // email → page url where first seen
  const phones = new Map();
  const ppl = [];
  let name = null, ldCity = null, allText = "";
  const pageText = new Map();
  for (const p of pages) {
    const root = parse(p.html);
    for (const ld of jsonLd(root)) {
      if (!name && typeof ld.name === "string" && /Business|Organization|HVAC|Contractor|Plumber|Electrician|HomeAndConstruction/i.test(String(ld["@type"]))) name = ld.name;
      if (!ldCity && ld.address?.addressLocality) ldCity = ld.address.addressLocality;
    }
    if (!name) name = root.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ?? null;
    for (const a of root.querySelectorAll('a[href^="mailto:"]')) {
      const e = decodeURIComponent(a.getAttribute("href").slice(7).split("?")[0]).trim().toLowerCase();
      if (EMAIL_RE.test(e) && !NOISE.test(e) && !emails.has(e)) emails.set(e, p.url);
      EMAIL_RE.lastIndex = 0;
    }
    for (const a of root.querySelectorAll('a[href^="tel:"]')) {
      const d = a.getAttribute("href").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      if (/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) phones.set(`+1${d}`, (phones.get(`+1${d}`) ?? 0) + 2);
    }
    const text = textOf(root);
    pageText.set(p.url, text);
    allText += `\n${text}`;
    for (const m of text.matchAll(EMAIL_RE)) { const e = m[0].toLowerCase(); if (!NOISE.test(e) && !emails.has(e)) emails.set(e, p.url); }
    for (const m of text.matchAll(PHONE_RE)) { const k = `+1${m[1]}${m[2]}${m[3]}`; phones.set(k, (phones.get(k) ?? 0) + 1); }
    ppl.push(...people(text));
  }
  if (!name) {
    const title = parse(home.html).querySelector("title")?.text ?? "";
    name = title.split(/\s[|\-–—·]\s/).map((s) => s.trim()).find((s) => s && !/^(home|welcome|homepage)$/i.test(s)) ?? null;
  }

  const lower = allText.toLowerCase();
  const services = (SERVICES[trade] ?? []).filter((s) => lower.includes(s));
  const res = (allText.match(RESIDENTIAL) ?? []).length, com = (allText.match(COMMERCIAL) ?? []).length;
  const segment = res && com ? "mixed" : com ? "commercial" : res ? "residential" : "unknown";
  const claims247 = CLAIM_247.test(allText);
  const foundCity = ldCity ?? (new RegExp(`\\b${city}\\b`, "i").test(allText) ? city : null);
  const phone = [...phones].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const today = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
  const contacts = [...emails].map(([email, srcUrl]) => {
    const flags = emailFlags(email);
    const local = email.split("@")[0].toLowerCase();
    const person = ppl.find((p) => local.includes(p.name.split(" ")[0].toLowerCase()));
    // The source page first, then every other page we fetched: a refusal anywhere on the firm's
    // own site applies to its published emails.
    const scanned = [srcUrl, ...[...pageText.keys()].filter((u) => u !== srcUrl)];
    let hit = null;
    for (const u of scanned) {
      const ph = REFUSAL_PHRASES.find((x) => (pageText.get(u) ?? "").toLowerCase().includes(x));
      if (ph) { hit = { ph, u }; break; }
    }
    const who = person ? `${person.title} (${person.name}) at` : flags.includes("role") ? "Published general inbox of" : "Published business email at";
    const what = services.length ? `, which lists ${services.slice(0, 3).join(", ")}` : "";
    return {
      email, flags, name: person?.name ?? null, title: person?.title ?? null,
      source_url: srcUrl,
      capture_date: today,
      no_refusal_checked_where: hit
        ? `Scanned ${scanned.join(", ")} on ${today}: refusal statement found on ${hit.u} ("${hit.ph}")`
        : `Scanned ${scanned.join(", ")} on ${today} for refusal statements (${REFUSAL_PHRASES.length} phrases): none found`,
      refusal_found: hit ? `"${hit.ph}" on ${hit.u}` : null,
      relevance_rationale: `${who} ${name ?? new URL(home.url).host}, a ${segment === "unknown" ? "" : `${segment} `}${trade.toUpperCase()} business in ${foundCity ?? city}${what}${claims247 ? ", advertising 24/7 or emergency service" : ""}. Relevant to missed-call follow-up and website conversion for a trade that lives on inbound calls.`,
    };
  });

  return {
    ok: true, name, phone, city: foundCity, segment, contacts,
    enrichment: { pages: pages.map((p) => p.url), services, claims_247: claims247, residential_signals: res, commercial_signals: com, people: ppl.slice(0, 5) },
  };
}

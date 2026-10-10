#!/usr/bin/env node
/**
 * Checks content/site.json before every build (npm "prebuild").
 * A client build fails on any missing required field, placeholder text or
 * failing colour contrast, so nothing half-filled reaches a deploy.
 *
 *   node scripts/validate-content.mjs [path] [--deploy]
 *   --deploy  also refuses the fictional fixture (content/example.json)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TRADES = ["hvac", "plumbing", "electrical"];
const ACTIONS = ["call", "form", "booking", "quote"];
const PLACEHOLDER = /lorem|ipsum|\bTODO\b|\bTBD\b|\bXXX\b|\{[a-z_]+\}|REPLACE/i;
// From build-site references/copy-formulas.md. Warned, not failed.
const FILLER = [/trusted local expert/i, /take pride in our work/i, /customer satisfaction is our/i, /serving the community for years/i, /second to none/i];

// ---- WCAG contrast ----------------------------------------------------------
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/** Returns { errors, warnings }. mode comes from the content itself. */
export function validate(c, { deploy = false } = {}) {
  const errors = [], warnings = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const str = (v) => typeof v === "string" && v.trim().length > 0;
  const client = c?.mode === "client";

  need(c?.mode === "client" || c?.mode === "mock", `mode must be "client" or "mock"`);
  if (deploy && c?.fixture) errors.push("fixture: this is the fictional example content; replace content/site.json before deploying");

  const b = c?.business ?? {};
  need(str(b.name), "business.name is required");
  need(TRADES.includes(b.trade), `business.trade must be one of ${TRADES.join(", ")}`);
  need(/^\+1\d{10}$/.test(b.phone ?? ""), "business.phone must be E.164, e.g. +13065550123");
  if (b.email !== undefined) need(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email), "business.email doesn't look like an email");

  need(str(c?.area?.primary), "area.primary is required");
  need(Array.isArray(c?.area?.cities) && c.area.cities.length > 0 && c.area.cities.every(str), "area.cities needs at least one city");

  const cv = c?.conversion ?? {};
  need(ACTIONS.includes(cv.action), `conversion.action must be exactly one of ${ACTIONS.join(", ")}`);
  need(str(cv.label), "conversion.label is required");
  if (str(cv.label)) need(!/^(submit|learn more|click here)$/i.test(cv.label.trim()), `conversion.label "${cv.label}" doesn't state the outcome`);
  if (cv.action === "booking") need(/^https:\/\//.test(cv.bookingUrl ?? ""), "conversion.bookingUrl (https) is required when action is booking");

  need(str(c?.hero?.headline), "hero.headline is required");
  need(str(c?.hero?.subhead), "hero.subhead is required");

  const services = Array.isArray(c?.services) ? c.services : [];
  need(services.length >= (client ? 3 : 1), `services needs at least ${client ? 3 : 1}`);
  const slugs = new Set();
  services.forEach((s, i) => {
    need(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s?.slug ?? ""), `services[${i}].slug must be kebab-case`);
    need(!slugs.has(s?.slug), `services[${i}].slug "${s?.slug}" is used twice`);
    slugs.add(s?.slug);
    for (const k of ["name", "summary", "whenNeeded", "differentiator"]) need(str(s?.[k]), `services[${i}].${k} is required`);
  });

  if (client) {
    need(str(c?.fear?.fear), "fear.fear is required: what the customer is afraid of (build-site step 1)");
    need(str(c?.fear?.answer), "fear.answer is required: what the business does about it");
    const p = c?.proof ?? {};
    const reviews = p.reviews ?? [], stats = p.stats ?? [], badges = p.badges ?? [];
    need(reviews.length + stats.length + badges.length > 0, "proof needs at least one review, stat or badge");
    reviews.forEach((r, i) => ["text", "author", "source"].forEach((k) => need(str(r?.[k]), `proof.reviews[${i}].${k} is required`)));
    stats.forEach((s, i) => ["value", "label", "source"].forEach((k) => need(str(s?.[k]), `proof.stats[${i}].${k} is required (label every number)`)));
  }

  const br = c?.brand ?? {};
  const hex = (k) => { const ok = /^#[0-9a-fA-F]{6}$/.test(br[k] ?? ""); need(ok, `brand.${k} must be a 6-digit hex colour`); return ok; };
  if (["ink", "bg", "primary", "primaryInk", "muted"].map(hex).every(Boolean)) {
    const check = (fg, bg, min, what) => {
      const r = contrast(br[fg], br[bg]);
      need(r >= min, `contrast ${what} is ${r.toFixed(2)}:1, needs ${min}:1 (WCAG 2.1 AA)`);
    };
    check("ink", "bg", 4.5, "brand.ink on brand.bg");
    check("muted", "bg", 4.5, "brand.muted on brand.bg");
    check("primaryInk", "primary", 4.5, "brand.primaryInk on brand.primary");
    check("primary", "bg", 4.5, "brand.primary on brand.bg (error text, focus rings)");
  }

  need(str(c?.legal?.province), "legal.province is required");
  need(str(c?.legal?.privacyContact), "legal.privacyContact is required");

  // Placeholder and filler scan over every string
  const walk = (v, path) => {
    if (typeof v === "string") {
      if (client && PLACEHOLDER.test(v)) errors.push(`${path} contains placeholder text: "${v.slice(0, 60)}"`);
      for (const f of FILLER) if (f.test(v)) warnings.push(`${path} reads as generic filler: "${v.slice(0, 60)}"`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(c, "");

  return { errors, warnings };
}

// ---- CLI --------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--")) ?? join(dirname(fileURLToPath(import.meta.url)), "../content/site.json");
  let content;
  try { content = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { console.error(`content: can't read ${file}: ${e.message}`); process.exit(1); }
  const { errors, warnings } = validate(content, { deploy: args.includes("--deploy") });
  for (const w of warnings) console.warn(`warn  ${w}`);
  if (errors.length) {
    console.error(`\n${file}: ${errors.length} problem(s)\n` + errors.map((e) => `  ✗ ${e}`).join("\n") + "\n");
    process.exit(1);
  }
  console.log(`content ok (${content.mode}${content.fixture ? ", fictional fixture" : ""})`);
}

/**
 * No secrets or env values in the built output.
 *   - the repo's build dir (out/, dist/, .next/static) if a repo is given
 *   - every same-origin HTML/JS/CSS/JSON the site actually served during the crawl
 * Hits: real values from the repo's .dev.vars / .env* files (except NEXT_PUBLIC_*, which are public
 * by design), private-key blocks, and well-known secret formats. Evidence never prints the secret.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const FORMATS = [
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Stripe live secret", /\bsk_live_[0-9a-zA-Z]{16,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[abpr]-[0-9A-Za-z-]{10,}/],
  ["GitHub token", /\bgh[pousr]_[0-9A-Za-z]{30,}/],
  ["Twilio API key SID", /\bSK[0-9a-f]{32}\b/],
  ["Anthropic key", /\bsk-ant-[0-9A-Za-z_-]{20,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Cloudflare service-token secret", /\bcfast_[0-9A-Za-z]{20,}/],
];

export function envValues(repo) {
  const vals = [];
  if (!repo) return vals;
  for (const f of readdirSync(repo).filter((f) => f === ".dev.vars" || /^\.env(\..+)?$/.test(f)).filter((f) => f !== ".env.example")) {
    for (const line of readFileSync(join(repo, f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?(.+?)["']?\s*$/);
      if (m && !m[1].startsWith("NEXT_PUBLIC_") && m[2].length >= 8) vals.push({ name: m[1], value: m[2], file: f });
    }
  }
  return vals;
}

export function scanText(text, where, vals) {
  const hits = [];
  for (const [label, re] of FORMATS) if (re.test(text)) hits.push(`${label} in ${where}`);
  for (const v of vals) if (text.includes(v.value)) hits.push(`value of ${v.name} (from ${v.file}) in ${where}`);
  return hits;
}

function* files(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) yield* files(p);
    else if (/\.(html?|js|mjs|css|json|txt|map)$/i.test(f) && st.size < 15_000_000) yield p;
  }
}

/** Scans the build dir. Returns { scanned, hits, dir } or null when no build dir exists. */
export function scanBuild(repo, vals) {
  const dir = ["out", "dist", ".next/static", "build"].map((d) => join(repo, d)).find((d) => existsSync(d));
  if (!dir) return null;
  let scanned = 0;
  const hits = [];
  for (const f of files(dir)) { scanned++; hits.push(...scanText(readFileSync(f, "utf8"), relative(repo, f), vals)); }
  return { dir: relative(repo, dir), scanned, hits };
}

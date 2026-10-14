/**
 * Shared runner plumbing. Config lives OUTSIDE the repo in ~/.arkosa/ops-runner.env (chmod 600):
 *   OPS_URL=https://ops.thearkosa.com
 *   CF_ACCESS_CLIENT_ID=…            service token (Access → Service Auth policy)
 *   CF_ACCESS_CLIENT_SECRET=…
 *   GOOGLE_PLACES_KEY=               empty = Places source off
 *   SNAPSHOT_DELAY_SEC=20
 * Real environment variables override the file (the local tests use that).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import robotsParser from "robots-parser";

export const CONTACT_URL = "https://thearkosa.com";
export const UA_SNAPSHOT = `Mozilla/5.0 (compatible; ArkosaSiteCheck/1.0; +${CONTACT_URL}; internal research)`;
export const UA_ENRICH = `ArkosaLeadResearch/1.0 (+${CONTACT_URL})`;
export const ARKOSA_DIR = process.env.ARKOSA_DIR ?? join(homedir(), ".arkosa");

export function loadConfig() {
  const file = {};
  try {
    for (const line of readFileSync(join(ARKOSA_DIR, "ops-runner.env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) file[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  const get = (k, d = "") => process.env[k] ?? file[k] ?? d;
  return {
    opsUrl: get("OPS_URL").replace(/\/$/, ""),
    clientId: get("CF_ACCESS_CLIENT_ID"),
    clientSecret: get("CF_ACCESS_CLIENT_SECRET"),
    placesKey: get("GOOGLE_PLACES_KEY"),
    delaySec: Number(get("SNAPSHOT_DELAY_SEC", "20")),
    // Local tests only: send a pre-made Access JWT instead of the service-token headers.
    testJwt: process.env.OPS_TEST_JWT ?? "",
  };
}

/** Calls the console as the runner. Cloudflare Access turns the service-token headers into a JWT. */
export function opsClient(cfg) {
  if (!cfg.opsUrl) throw new Error("OPS_URL is not set (~/.arkosa/ops-runner.env)");
  const auth = cfg.testJwt
    ? { "cf-access-jwt-assertion": cfg.testJwt }
    : { "CF-Access-Client-Id": cfg.clientId, "CF-Access-Client-Secret": cfg.clientSecret };
  return async (path, { method = "GET", json, form } = {}) => {
    const res = await fetch(cfg.opsUrl + path, {
      method,
      headers: { ...auth, ...(json !== undefined ? { "content-type": "application/json" } : {}) },
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.error ?? data.raw ?? ""}`);
    return data;
  };
}

/** robots.txt check. A missing or unreadable robots.txt means allowed (standard behaviour). */
const robotsCache = new Map();
export async function robotsAllows(url, ua) {
  const u = new URL(url);
  const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
  if (!robotsCache.has(robotsUrl)) {
    let body = "";
    try {
      const res = await fetch(robotsUrl, { headers: { "user-agent": ua }, signal: AbortSignal.timeout(15_000), redirect: "follow" });
      if (res.ok) body = (await res.text()).slice(0, 500_000);
    } catch {}
    robotsCache.set(robotsUrl, robotsParser(robotsUrl, body));
  }
  return robotsCache.get(robotsUrl).isAllowed(url, uaToken(ua)) !== false;
}

/** The product token robots.txt groups match on: "ArkosaSiteCheck" / "ArkosaLeadResearch". */
export const uaToken = (ua) => (ua.match(/Arkosa[A-Za-z]+/) ?? ["Arkosa"])[0];

/** ~/.arkosa/snapshot-skip.txt: one domain per line (# comments). Also used by enrichment. */
export function skipList() {
  try {
    return new Set(readFileSync(join(ARKOSA_DIR, "snapshot-skip.txt"), "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim().toLowerCase()).filter(Boolean));
  } catch { return new Set(); }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toISOString(), ...a);

#!/usr/bin/env node
/**
 * Local end-to-end run of the console's Functions. Nothing leaves this Mac:
 *   - a mock Cloudflare Access certs endpoint on 127.0.0.1, and real RS256 JWTs signed for it
 *   - `wrangler pages dev ./dist` with a throwaway local D1 (website + console migrations) and R2
 * Fictional data only (Northgate, .example domains, 555-01xx numbers).
 *   npm run build && node test/e2e-local.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = join(ROOT, "../website/arkosa-site");
const STATE = mkdtempSync(join(tmpdir(), "ops-console-"));
const PORT = 8795;
const BASE = `http://127.0.0.1:${PORT}`;
const AUD = "test-aud";
const SECRETS = { PHONE_HASH_KEY: "local-hash-key", SNAPSHOT_URL_KEY: "local-snapshot-key" };
const env = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- mock Access: certs + token minting ------------------------------------------------------
const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "e2e" };
const certs = http.createServer((req, res) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ keys: [jwk] })));
await new Promise((r) => certs.listen(0, "127.0.0.1", r));
const TEAM = `http://127.0.0.1:${certs.address().port}`;
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
async function jwt(claims) {
  const now = Math.floor(Date.now() / 1000);
  const h = enc({ alg: "RS256", kid: "e2e" }), p = enc({ iss: TEAM, aud: [AUD], iat: now, exp: now + 3600, ...claims });
  return `${h}.${p}.${Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(`${h}.${p}`))).toString("base64url")}`;
}
const OP = await jwt({ email: "operator@example.com" });
const RUNNER = await jwt({ common_name: "runner.access", sub: "" });

async function call(path, { method = "GET", body, token = OP, origin = true, raw = false, form } = {}) {
  const headers = {};
  if (token) headers["cf-access-jwt-assertion"] = token;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (origin && method !== "GET") headers.origin = BASE;
  const res = await fetch(BASE + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect: "manual" });
  if (raw) return res;
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
function d1(sql) {
  const r = spawnSync("npx", ["--no-install", "wrangler", "d1", "execute", "arkosa", "--local", "--persist-to", STATE, "--json", "--command", sql], { cwd: ROOT, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("[")))[0].results;
}
const migrate = (cwd) => spawnSync("npx", ["--no-install", "wrangler", "d1", "migrations", "apply", "arkosa", "--local", "--persist-to", STATE], { cwd, env, encoding: "utf8" });
const pending = (cwd) => spawnSync("npx", ["--no-install", "wrangler", "d1", "migrations", "list", "arkosa", "--local", "--persist-to", STATE], { cwd, env, encoding: "utf8" }).stdout;

let pages;
try {
  // Website migrations first (leads, demo_calls), then the console's, into ONE local D1.
  check(migrate(SITE).status === 0, "website migrations apply (0001, 0002)");
  check(migrate(ROOT).status === 0, "console migrations apply (1001+) to the same D1");
  check(/No migrations to apply/i.test(pending(SITE)) && /No migrations to apply/i.test(pending(ROOT)), "neither project sees the other's migrations as pending");

  // Fictional inbound lead + a demo call from the company's phone.
  d1("INSERT INTO leads (name, company, email, phone, trade, city, message, ip_hash) VALUES ('Sam Example','Prairie Air Example','sam@prairieair.example','306-555-0177','HVAC','Saskatoon','Missed calls in winter','x')");
  const demoHash = createHmac("sha256", SECRETS.PHONE_HASH_KEY).update("+13065550123").digest("hex");
  d1(`INSERT INTO demo_calls (caller_hash, caller_last4, call_sid, sms_sent) VALUES ('${demoHash}', '0123', 'CAe2e', 1)`);
  const leadBefore = JSON.stringify(d1("SELECT * FROM leads"));

  const bindings = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ACCESS_EMAILS: "operator@example.com", RUNNER_CLIENT_IDS: "runner.access", ...SECRETS };
  pages = spawn("npx", ["--no-install", "wrangler", "pages", "dev", "./dist", "--port", String(PORT), "--inspector-port", "9339", "--persist-to", STATE,
    ...Object.entries(bindings).flatMap(([k, v]) => ["--binding", `${k}=${v}`])], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; pages.stdout.on("data", (d) => (log += d)); pages.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 120; i++) { try { await fetch(BASE); break; } catch { await sleep(500); } }

  // ---- auth --------------------------------------------------------------------------------------
  check((await call("/api/companies", { token: null })).status === 403, "API without an Access JWT → 403");
  check((await call("/", { token: null, raw: true })).status === 403, "the app shell itself without a JWT → 403");
  const shell = await call("/", { raw: true });
  check(shell.status === 200 && (shell.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"), "operator gets the app, with CSP");
  check((await call("/api/companies", { token: await jwt({ email: "stranger@example.com" }) })).status === 403, "email not on the list → 403");
  check((await call("/api/companies", { token: RUNNER })).status === 403, "runner token outside /api/runner → 403");
  check((await call("/api/suppression", { method: "POST", body: { kind: "email", value: "a@b.example", reason: "x" }, origin: false })).status === 403, "write without same-origin → 403");

  // ---- import with CASL quarantine and suppression ------------------------------------------------
  await call("/api/suppression", { method: "POST", body: { kind: "domain", value: "blocked.example", reason: "asked not to be contacted" } });
  const csv = [
    "company,domain,phone,city,segment,email,source_url,capture_date,no_refusal_checked_where,relevance_rationale,next_action,next_action_type,next_action_due",
    "Northgate Heating & Air,northgate.example,306-555-0123,Saskatoon,residential,office@northgate.example,https://northgate.example/contact,2026-10-13,Contact page: no refusal found,Office manager at a residential HVAC firm,Call owner,call,2026-10-01",
    "Half Done Heating,halfdone.example,306-555-0124,Saskatoon,commercial,info@halfdone.example,,2026-10-13,,Commercial HVAC,,,",
    "Blocked Mechanical,blocked.example,306-555-0125,Saskatoon,mixed,info@blocked.example,https://blocked.example,2026-10-13,checked,relevant,,,",
    "No Contact Yet Furnace,nocontact.example,,Saskatoon,unknown,,,,,,,,",
  ].join("\n");
  const imp = (await call("/api/import", { method: "POST", body: { csv } })).data;
  check(imp.companies_created === 2 && imp.contacts_created === 1 && imp.quarantined === 1 && imp.suppressed_dropped === 1,
    `import: 2 companies, 1 contact, 1 quarantined, 1 suppressed dropped (${JSON.stringify(imp)})`);
  const q = (await call("/api/quarantine")).data.rows;
  check(q.length === 1 && q[0].missing.includes("source_url") && q[0].missing.includes("no_refusal_checked_where"), "quarantine names the missing CASL fields");
  check((await call(`/api/quarantine/${q[0].id}`, { method: "POST", body: { row: q[0].row } })).status === 409, "quarantine retry still incomplete → refused");
  const fixed = { ...q[0].row, source_url: "https://halfdone.example/contact", no_refusal_checked_where: "Contact page: no refusal found" };
  check((await call(`/api/quarantine/${q[0].id}`, { method: "POST", body: { row: fixed } })).status === 200, "quarantine retry with fields filled → imported");

  const companies = (await call("/api/companies")).data.companies;
  const ng = companies.find((c) => c.domain === "northgate.example");
  check(!!ng && ng.casl_complete === 1 && ng.fit && Array.isArray(ng.fit.parts), "company list carries CASL-complete and the fit breakdown");
  check(!companies.some((c) => c.domain === "blocked.example"), "suppressed row never created");

  // ---- CASL ready gate ---------------------------------------------------------------------------
  let detail = (await call(`/api/companies/${ng.id}`)).data;
  const contact = detail.contacts[0];
  check((await call(`/api/contacts/${contact.id}`, { method: "PATCH", body: { ready: true } })).status === 409, "ready without the source-page tick → refused");
  check((await call(`/api/contacts/${contact.id}`, { method: "PATCH", body: { ready: true, checked_source: true } })).status === 200, "ready with the tick → accepted");
  check((await call("/api/ready")).data.contacts.length === 1, "send view lists the ready contact");
  await call(`/api/contacts/${contact.id}`, { method: "PATCH", body: { relevance_rationale: "Changed wording" } });
  detail = (await call(`/api/companies/${ng.id}`)).data;
  check(detail.contacts[0].ready_to_send === 0 && detail.contacts[0].casl_verified_at === null, "editing a CASL field clears the tick and readiness");
  await call(`/api/contacts/${contact.id}`, { method: "PATCH", body: { ready: true, checked_source: true } });
  await call("/api/suppression", { method: "POST", body: { kind: "email", value: "office@northgate.example", reason: "bounced" } });
  check((await call("/api/ready")).data.contacts.length === 0, "suppressing the email removes it from the send view");
  const again = await call(`/api/contacts/${contact.id}`, { method: "PATCH", body: { ready: true, checked_source: true } });
  check(again.status === 409 && /Suppressed/.test(again.data.error), "suppressed contact can't be marked ready");

  // ---- stage move logs a touch -----------------------------------------------------------------------
  await call(`/api/companies/${ng.id}/stage`, { method: "POST", body: { stage: "contacted" } });
  detail = (await call(`/api/companies/${ng.id}`)).data;
  check(detail.company.stage === "contacted" && detail.touches.some((t) => t.type === "stage_change" && /Prospect → Contacted/.test(t.outcome)), "stage move logs a stage_change touch");
  check(detail.demo_calls.length === 1 && detail.demo_calls[0].last4 === "0123", "demo call matched to the company by hashed phone");

  // ---- snapshots: runner upload, signed URLs -------------------------------------------------------
  const targets = (await call("/api/runner/targets", { token: RUNNER })).data.targets;
  check(targets.some((t) => t.domain === "northgate.example"), "runner targets include a company with no snapshot");
  const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
  const form = new FormData();
  form.set("company_id", String(ng.id));
  form.set("meta", JSON.stringify({ url: "https://northgate.example/", tel_link: false, phone_above_fold_mobile: false, form: true, https: true, lh_mobile_perf: 41 }));
  form.set("desktop", new Blob([jpeg], { type: "image/jpeg" }), "d.jpg");
  form.set("mobile", new Blob([jpeg], { type: "image/jpeg" }), "m.jpg");
  check((await call("/api/runner/snapshots", { method: "POST", token: RUNNER, form, origin: false })).status === 201, "runner uploads a snapshot (R2 + row)");
  detail = (await call(`/api/companies/${ng.id}`)).data;
  const s = detail.snapshot;
  check(s && s.tel_link === 0 && s.lh_mobile_perf === 41 && /sig=/.test(s.desktop_url), "snapshot row + signed screenshot URLs");
  const img = await call(s.desktop_url, { raw: true });
  check(img.status === 200 && img.headers.get("content-type") === "image/jpeg", "signed URL serves the image from private R2");
  check((await call(s.desktop_url.replace(/sig=[0-9a-f]{4}/, "sig=0000"), { raw: true })).status === 403, "tampered signature → 403");
  const exp = Math.floor(Date.now() / 1000) - 5;
  const expiredSig = createHmac("sha256", SECRETS.SNAPSHOT_URL_KEY).update(`${s.id}:desktop:${exp}`).digest("hex");
  check((await call(`/api/snapshots/${s.id}/desktop?exp=${exp}&sig=${expiredSig}`, { raw: true })).status === 403, "expired signed URL → 403");
  check((await call(s.desktop_url, { raw: true, token: null })).status === 403, "signed URL without Access JWT → 403");
  const fitNow = (await call("/api/companies")).data.companies.find((c) => c.id === ng.id).fit;
  check(fitNow.parts.some((p) => p.id === "no_tel") && fitNow.parts.some((p) => p.id === "slow_mobile"), `fit breakdown uses the snapshot (${fitNow.parts.map((p) => p.id).join(", ")})`);

  // ---- leads: read-only, promote --------------------------------------------------------------------
  const leads = (await call("/api/leads")).data.leads;
  check(leads.length === 1 && leads[0].company === "Prairie Air Example", "inbound lead read from `leads`");
  const prom = await call(`/api/leads/${leads[0].id}/promote`, { method: "POST", body: {} });
  check(prom.status === 201, "lead promoted into the pipeline");
  check(JSON.stringify(d1("SELECT * FROM leads")) === leadBefore, "`leads` table unchanged by the console");
  const today = (await call("/api/today")).data;
  check(today.calls_due.some((c) => c.id === ng.id) && today.demo_calls.length === 1 && today.demo_calls[0].company?.id === ng.id, "Today: overdue call + matched demo call");

  // ---- export is aggregates only ---------------------------------------------------------------------
  const csvOut = await (await call("/api/export", { raw: true })).text();
  check(csvOut.startsWith("stage,segment,source,casl_complete,suppressed,companies") && !/@|\.example|555/.test(csvOut), "export CSV holds counts only (no emails, domains, phones)");

  // ---- suppression is append-only via the API too -----------------------------------------------------
  const del = await call("/api/suppression", { method: "DELETE", body: {} });
  console.log("  DELETE /api/suppression →", del.status, JSON.stringify(del.data));
  check(del.status === 405 && d1("SELECT count(*) AS n FROM suppression")[0].n === 2, "DELETE on suppression → 405, list intact");
  check((await call("/api/nope")).status === 404, "unknown API path → JSON 404, not the app shell");
} catch (e) {
  failures++;
  console.error("ERROR", e);
} finally {
  if (pages && pages.exitCode === null) pages.kill("SIGINT");
  certs.close();
  await sleep(800);
  rmSync(STATE, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);

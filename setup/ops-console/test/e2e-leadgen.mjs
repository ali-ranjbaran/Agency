#!/usr/bin/env node
/**
 * Lead generator end to end, locally: the console's Functions (wrangler pages dev, local D1) and
 * the REAL runner code (jobs.mjs + enrich.mjs) against fictional fixture firms on *.localhost.
 * No real site, no Overpass, no Google. Snapshots are stubbed here (tested in runner/test).
 *   npm run build && node test/e2e-leadgen.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runJob } from "../runner/jobs.mjs";
import { politeFetcher } from "../runner/enrich.mjs";
import { opsClient } from "../runner/lib.mjs";
import { startFixtures } from "../runner/test/fixtures.mjs";

process.env.ARKOSA_DIR = "/nonexistent"; // no real skip list / config
const ROOT = new URL("..", import.meta.url).pathname;
const SITE = join(ROOT, "../website/arkosa-site");
const STATE = mkdtempSync(join(tmpdir(), "ops-leadgen-"));
const PORT = 8796, BASE = `http://127.0.0.1:${PORT}`, AUD = "test-aud";
const env = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "lg" };
const certs = http.createServer((q, r) => r.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ keys: [jwk] })));
await new Promise((r) => certs.listen(0, "127.0.0.1", r));
const TEAM = `http://127.0.0.1:${certs.address().port}`;
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
async function jwt(claims) {
  const now = Math.floor(Date.now() / 1000);
  const h = enc({ alg: "RS256", kid: "lg" }), p = enc({ iss: TEAM, aud: [AUD], iat: now, exp: now + 3600, ...claims });
  return `${h}.${p}.${Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(`${h}.${p}`))).toString("base64url")}`;
}
const OP = await jwt({ email: "operator@example.com" });
const RUNNER = await jwt({ common_name: "runner.access", sub: "" });
async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, { method, headers: { "cf-access-jwt-assertion": OP, ...(body !== undefined ? { "content-type": "application/json", origin: BASE } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const t = await res.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
  return { status: res.status, data };
}
const runnerApi = opsClient({ opsUrl: BASE, testJwt: RUNNER });
const d1 = (sql) => { const r = spawnSync("npx", ["--no-install", "wrangler", "d1", "execute", "arkosa", "--local", "--persist-to", STATE, "--json", "--command", sql], { cwd: ROOT, env, encoding: "utf8" }); return JSON.parse(r.stdout.slice(r.stdout.indexOf("[")))[0].results; };

let pages, fx;
try {
  for (const cwd of [SITE, ROOT]) spawnSync("npx", ["--no-install", "wrangler", "d1", "migrations", "apply", "arkosa", "--local", "--persist-to", STATE], { cwd, env });
  const bindings = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ACCESS_EMAILS: "operator@example.com", RUNNER_CLIENT_IDS: "runner.access", PHONE_HASH_KEY: "k", SNAPSHOT_URL_KEY: "s", PLACES_MONTHLY_CAP: "2" };
  pages = spawn("npx", ["--no-install", "wrangler", "pages", "dev", "./dist", "--port", String(PORT), "--inspector-port", "9341", "--persist-to", STATE,
    ...Object.entries(bindings).flatMap(([k, v]) => ["--binding", `${k}=${v}`])], { cwd: ROOT, env, stdio: "ignore" });
  for (let i = 0; i < 120; i++) { try { await fetch(BASE); break; } catch { await sleep(500); } }
  fx = await startFixtures();
  const port = new URL(fx.base).port;
  const url = (host, path) => `http://${host}.localhost:${port}${path}`;
  const URLS = [url("northgate", "/good/"), url("prairie", "/bad/"), url("noscrape", "/noscrape/"), url("blocked", "/good/")].join("\n");

  // Operator: a suppressed firm, then queue a manual search.
  await call("/api/suppression", { method: "POST", body: { kind: "domain", value: "blocked.localhost", reason: "asked not to be contacted" } });
  const q = await call("/api/searches", { method: "POST", body: { trade: "hvac", city: "Saskatoon", sources: ["manual"], manual_urls: URLS, save: true } });
  check(q.status === 201, "operator queues a search");

  // Runner: claim and run it with the real runner code.
  const snapped = [];
  const claim1 = await runnerApi("/api/runner/jobs/claim", { method: "POST", json: {} });
  check(claim1.job?.manual_urls?.length === 4, "runner claims the job atomically");
  check((await runnerApi("/api/runner/jobs/claim", { method: "POST", json: {} })).job === null, "a second claim gets nothing (no double-run)");
  const r1 = await runJob(runnerApi, claim1.job, { fetcher: politeFetcher({ delayMs: 20 }), snapshot: async (t) => snapped.push(...t) });
  await runnerApi(`/api/runner/jobs/${claim1.job.id}/finish`, { method: "POST", json: { status: "done", counts: r1.counts } });
  check(r1.counts.found === 4 && r1.counts.suppressed_dropped === 1 && r1.counts.new_candidates === 3, `run 1: 4 found, 1 suppressed dropped, 3 new (${JSON.stringify(r1.counts)})`);
  check(snapped.length === 3 && snapped.every((s) => s.domain), "every new candidate is handed to the snapshot capture");

  // Review queue
  let rev = (await call("/api/review")).data;
  const byDomain = (d) => rev.candidates.find((c) => c.domain === d);
  check(rev.candidates.length === 3 && !byDomain("blocked.localhost"), "review queue: 3 candidates, the suppressed firm never shown");
  const ng = byDomain("northgate.localhost"), pr = byDomain("prairie.localhost"), ns = byDomain("noscrape.localhost");
  check(ng.contacts.every((k) => k.casl_draft === 1 && k.ready_to_send === 0), "contacts arrive as CASL drafts, not ready");
  check(ng.contacts.find((k) => k.email === "office@northgate.example")?.source_url === url("northgate", "/good/contact"), "draft source_url = the exact page the email appears on");
  check(ng.sources[0].source === "manual" && ng.city === "Saskatoon" && ng.segment === "mixed", "sources, city and segment guess recorded");
  check(!(await call("/api/companies")).data.companies.some((c) => c.stage === "candidate"), "candidates stay out of the pipeline table");
  check((await call("/api/ready")).data.contacts.length === 0, "nothing sendable before approval");
  const early = await call(`/api/contacts/${ng.contacts[0].id}`, { method: "PATCH", body: { ready: true, checked_source: true } });
  check(early.status === 409, "a candidate's contact can't be marked ready before approval");
  check([404, 405].includes((await call("/api/review/approve", { method: "POST", body: { ids: [ng.id, pr.id] } })).status), "no bulk-approve endpoint");

  // Approve Northgate with ONE contact ticked; approve the refusal firm with its contact ticked.
  const office = ng.contacts.find((k) => k.email === "office@northgate.example");
  const a1 = (await call(`/api/review/${ng.id}/approve`, { method: "POST", body: { checked: { [office.id]: true } } })).data;
  check(a1.contacts.filter((c) => c.ready).map((c) => c.id).join() === String(office.id), "approve: only the ticked contact becomes ready");
  const nsc = ns.contacts[0];
  const a2 = (await call(`/api/review/${ns.id}/approve`, { method: "POST", body: { checked: { [nsc.id]: true } } })).data;
  check(a2.contacts[0].ready === false && /refusal/.test(a2.contacts[0].why), "approve: a contact with a refusal statement stays not ready");
  check((await call("/api/ready")).data.contacts.map((c) => c.email).join() === "office@northgate.example", "send view: exactly the one checked contact");

  // Reject Prairie (bulk endpoint), remembered.
  check((await call("/api/review/reject", { method: "POST", body: { ids: [pr.id], reason: "commercial refrigeration only" } })).data.rejected === 1, "reject with a reason");
  rev = (await call("/api/review")).data;
  check(rev.candidates.length === 0, "queue empty");
  const u = rev.universe.find((x) => x.search_key === "hvac|saskatoon");
  check(u && u.found === 3 && u.approved === 2 && u.rejected === 1 && u.in_review === 0, `universe counter (${JSON.stringify(u)})`);

  // Re-run: only new firms. Add one new fictional firm to the URL list.
  const q2 = await call("/api/searches", { method: "POST", body: { trade: "hvac", city: "Saskatoon", sources: ["manual"], manual_urls: `${URLS}\n${url("eastside", "/new/")}` } });
  const claim2 = await runnerApi("/api/runner/jobs/claim", { method: "POST", json: {} });
  check(claim2.job?.id === q2.data.job_id, "second job claimed");
  const before = fx.hits.length;
  const r2 = await runJob(runnerApi, claim2.job, { fetcher: politeFetcher({ delayMs: 20 }), snapshot: async () => {} });
  await runnerApi(`/api/runner/jobs/${claim2.job.id}/finish`, { method: "POST", json: { status: "done", counts: r2.counts } });
  check(r2.counts.new_candidates === 1 && r2.counts.known === 2 && r2.counts.rejected_skipped === 1 && r2.counts.suppressed_dropped === 1,
    `re-run: 1 new, 2 known, 1 rejected skipped, 1 suppressed (${JSON.stringify(r2.counts)})`);
  check(fx.hits.slice(before).length <= 6, `re-run fetched only the new firm's pages (${fx.hits.slice(before).length} requests incl. robots.txt)`);

  // Jobs history + Places cap (PLACES_MONTHLY_CAP=2 in this run)
  const hist = (await call("/api/searches")).data;
  check(hist.jobs.length === 2 && hist.jobs.every((j) => j.status === "done") && hist.saved.length === 1, "history shows both jobs done, one saved search");
  const caps = [];
  for (let i = 0; i < 3; i++) caps.push((await runnerApi("/api/runner/places-usage", { method: "POST", json: {} })).ok);
  check(caps.join() === "true,true,false", `Places cap is hard (${caps.join()})`);
  check(!JSON.stringify(d1("SELECT * FROM companies")).match(/displayName|formattedAddress|rating/), "no Google fields stored");

  // ---- UI smoke: every page renders in a real browser, no console errors -----------------------
  const { chromium } = await import(new URL("../runner/node_modules/playwright/index.mjs", import.meta.url).href);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ extraHTTPHeaders: { "cf-access-jwt-assertion": OP } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  const ngId = d1("SELECT id FROM companies WHERE domain = 'northgate.localhost'")[0].id;
  for (const [path, expect] of [["/", "Today"], ["/companies", "Northgate Heating & Air"], ["/board", "Prospect"], ["/possible", "Possible clients"],
    [`/company/${ngId}`, "Contacts and CASL record"], ["/review", "Eastside Furnace Example"], ["/searches", "HVAC · Saskatoon"],
    ["/leads", "Inbound leads"], ["/ready", "office@northgate.example"], ["/import", "Quarantine"], ["/suppression", "blocked.localhost"]]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const ok = await page.getByText(expect, { exact: false }).first().isVisible().catch(() => false);
    check(ok, `UI ${path} renders "${expect}"`);
  }
  await page.goto(`${BASE}/companies`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Fit \d+, show breakdown/ }).first().hover();
  check(await page.getByText(/Fit \d+ of \d+/).first().isVisible().catch(() => false), "UI: fit breakdown shows on hover");
  check(!errors.length, `UI: no console errors${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
  await browser.close();
} catch (e) {
  failures++;
  console.error("ERROR", e);
} finally {
  if (pages && pages.exitCode === null) pages.kill("SIGINT");
  certs.close();
  await fx?.close();
  await sleep(800);
  rmSync(STATE, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);

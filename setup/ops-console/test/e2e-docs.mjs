#!/usr/bin/env node
/**
 * Local end-to-end run of Documents. Nothing leaves this Mac: mock Access certs, real RS256 JWTs,
 * `wrangler pages dev ./dist` on a throwaway local D1. The documents come from a fictional
 * fixture repo, so the "edit" step is a real edit: the fixture changes, the bundle is rebuilt,
 * the server restarts on the same D1, and the approval must no longer count.
 *   npm run build && node test/e2e-docs.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const STATE = mkdtempSync(join(tmpdir(), "ops-docs-"));
const FIX = mkdtempSync(join(tmpdir(), "ops-docs-repo-"));
const PORT = 8797;
const BASE = `http://127.0.0.1:${PORT}`;
const AUD = "test-aud";
const env = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fixture repo (fictional) -------------------------------------------------------------------
const write = (p, c) => { mkdirSync(join(FIX, p, ".."), { recursive: true }); writeFileSync(join(FIX, p), c); };
const MSA = "---\ntitle: Test MSA\nkind: contract\n---\n# Test MSA\n\n## Parties\n\n{LEGAL_NAME} and {CLIENT_LEGAL_NAME}. [LAWYER]\n\n## Liability cap\n\nCapped at {CAP_MONTHS} months. [LAWYER]\n\n<script>alert(1)</script>\n";
write("templates/contracts/msa.md", MSA);
write("agency-plan-v4.md", "# Plan\n## 0.3 Problems\n\n| # | Locked | Problem | Default | Affects |\n|---|---|---|---|---|\n| **D1** | 20 h | Too many | 9 / 6 | §1 |\n\n## 10.7 Proposed\n\n| # | Decision | Default | Affects |\n|---|---|---|---|\n| **D7** | Guarantee | 60 s | §3.3 |\n");
const bundle = () => {
  const r = spawnSync("node", ["scripts/collect-docs.mjs", "--root", FIX], { cwd: ROOT, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
};

// ---- mock Access --------------------------------------------------------------------------------
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

async function call(path, { method = "GET", body, token = OP, origin = true } = {}) {
  const headers = {};
  if (token) headers["cf-access-jwt-assertion"] = token;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (origin && method !== "GET") headers.origin = BASE;
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

let pages;
async function start() {
  const bindings = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ACCESS_EMAILS: "operator@example.com", RUNNER_CLIENT_IDS: "runner.access", SNAPSHOT_URL_KEY: "local-snapshot-key" };
  pages = spawn("npx", ["--no-install", "wrangler", "pages", "dev", "./dist", "--port", String(PORT), "--inspector-port", "9341", "--persist-to", STATE,
    ...Object.entries(bindings).flatMap(([k, v]) => ["--binding", `${k}=${v}`])], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/docs`)).status) break; } catch { await sleep(500); } }
}
async function stop() {
  if (pages && pages.exitCode === null) { pages.kill("SIGINT"); await new Promise((r) => pages.once("exit", r)); }
}

const MSA_PATH = "templates/contracts/msa.md";
const q = (p) => `/api/docs/item?path=${encodeURIComponent(p)}`;

try {
  check(spawnSync("npx", ["--no-install", "wrangler", "d1", "migrations", "apply", "arkosa", "--local", "--persist-to", STATE], { cwd: ROOT, env, encoding: "utf8" }).status === 0, "console migrations (incl. 1003) apply locally");
  bundle();
  await start();

  // ---- Access on every new endpoint -----------------------------------------------------------
  const endpoints = [["GET", "/api/docs"], ["GET", q(MSA_PATH)], ["POST", "/api/docs/review"], ["POST", "/api/docs/comments"], ["PATCH", "/api/docs/comments"], ["POST", "/api/decisions/signoff"]];
  for (const [method, path] of endpoints) {
    const body = method === "GET" ? undefined : {};
    check((await call(path, { method, body, token: null })).status === 403, `${method} ${path.split("?")[0]} without a JWT → 403`);
    check((await call(path, { method, body, token: RUNNER })).status === 403, `${method} ${path.split("?")[0]} with the runner token → 403`);
  }
  check((await call("/api/docs/review", { method: "POST", body: {}, origin: false })).status === 403, "write without same-origin → 403");

  // ---- list, item ------------------------------------------------------------------------------
  let list = (await call("/api/docs")).data;
  let msa = list.docs.find((d) => d.path === MSA_PATH);
  check(msa && msa.status === "unread" && msa.placeholders === 3 && msa.lawyer === 2, `list: msa unread, 3 placeholders, 2 [LAWYER] (${JSON.stringify(msa)})`);
  check(list.decisions.map((d) => d.id).join() === "D1,D7" && list.decisions.every((d) => !d.signoff), "decisions D1, D7 listed, unsigned");
  let item = (await call(q(MSA_PATH))).data;
  const sha1 = item.doc.sha256;
  check((await call(q("clients/acme/context.md"))).status === 404, "a path not in the bundle → 404");

  // ---- review → comment → approve ----------------------------------------------------------------
  check((await call("/api/docs/review", { method: "POST", body: { path: MSA_PATH, sha: sha1, status: "in_review" } })).status === 201, "mark in review");
  check((await call("/api/docs/comments", { method: "POST", body: { path: MSA_PATH, sha: sha1, anchor: "liability-cap", body: "12 months, not 6" } })).status === 201, "comment on a heading");
  check((await call("/api/docs/comments", { method: "POST", body: { path: MSA_PATH, sha: sha1, anchor: "no-such-heading", body: "x" } })).status === 400, "comment on an unknown heading → 400");
  check((await call("/api/docs/review", { method: "POST", body: { path: MSA_PATH, sha: sha1, status: "changes_requested" } })).status === 400, "request changes without a note → 400");
  check((await call("/api/docs/review", { method: "POST", body: { path: MSA_PATH, sha: "f".repeat(64), status: "approved" } })).status === 409, "approve a sha that isn't the current text → 409");
  check((await call("/api/docs/review", { method: "POST", body: { path: MSA_PATH, sha: sha1, status: "approved" } })).status === 201, "approve the current version");
  item = (await call(q(MSA_PATH))).data;
  check(item.status === "approved" && !item.changed_since_approved && item.comments.length === 1 && item.comments[0].reviewer === "operator@example.com", "approved; reviewer taken from the Access JWT");
  const cid = item.comments[0].id;
  check((await call("/api/docs/comments", { method: "PATCH", body: { id: cid, resolved: true } })).status === 200, "resolve the comment");

  // ---- decision sign-off ----------------------------------------------------------------------------
  const d1 = list.decisions.find((d) => d.id === "D1");
  check((await call("/api/decisions/signoff", { method: "POST", body: { id: "D1", sha: d1.sha256, choice: "amend" } })).status === 400, "amend without a note → 400");
  check((await call("/api/decisions/signoff", { method: "POST", body: { id: "D1", sha: d1.sha256, choice: "amend", note: "8 / 7 in term" } })).status === 201, "sign off D1 as amend + note");
  list = (await call("/api/docs")).data;
  check(list.decisions.find((d) => d.id === "D1").signoff?.choice === "amend", "D1 shows the sign-off");
  let today = (await call("/api/today")).data.docs;
  check(today.decisions_unsigned === 1 && today.changed_since_approved === 0 && today.open_lawyer === 2, `Today counts before the edit (${JSON.stringify(today)})`);

  // ---- edit → approval resets ----------------------------------------------------------------------
  await stop();
  write(MSA_PATH, MSA.replace("{CAP_MONTHS} months", "12 months"));
  bundle();
  await start();
  item = (await call(q(MSA_PATH))).data;
  check(item.doc.sha256 !== sha1 && item.status === "in_review" && item.changed_since_approved, `after the edit: in review, changed since approved (${item.status})`);
  check(item.last_approved?.content_sha === sha1 && item.last_approved.content.includes("{CAP_MONTHS}"), "last approved text is kept for the diff");
  check((await call("/api/docs/review", { method: "POST", body: { path: MSA_PATH, sha: sha1, status: "approved" } })).status === 409, "re-approving the old sha → 409");
  today = (await call("/api/today")).data.docs;
  check(today.changed_since_approved === 1 && today.awaiting_review >= 1, "Today shows the doc changed since approval");

  // ---- QA reports: runner upload → review --------------------------------------------------------
  const QA = mkdtempSync(join(tmpdir(), "ops-qa-"));
  mkdirSync(join(QA, "2026-10-14-northgate-demo", "screenshots"), { recursive: true });
  writeFileSync(join(QA, "2026-10-14-northgate-demo", "report.md"), "LAUNCH BLOCKED\n\n# qa-site report\n\n## Fails\n\n- legal.privacy: no privacy link\n");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  writeFileSync(join(QA, "2026-10-14-northgate-demo", "screenshots", "375.png"), png);
  process.env.OPS_URL = BASE; process.env.OPS_TEST_JWT = RUNNER;
  const { uploadAll } = await import(new URL("../runner/qa-upload.mjs", import.meta.url).href);
  const { loadConfig, opsClient } = await import(new URL("../runner/lib.mjs", import.meta.url).href);
  const runnerApi = opsClient(loadConfig());
  const statePath = join(QA, "state.json");
  check(await uploadAll(runnerApi, { qaDir: QA, statePath }) === 1, "runner uploads a new QA report");
  check(await uploadAll(runnerApi, { qaDir: QA, statePath }) === 0, "unchanged report isn't re-sent");
  check((await call("/api/runner/qa-reports", { method: "POST", body: {} })).status === 403, "operator can't use the runner upload endpoint");
  check((await call("/api/runner/qa-reports", { method: "POST", body: {}, token: null })).status === 403, "runner upload without a JWT → 403");
  const qaRow = (await call("/api/docs")).data.docs.find((d) => d.path === "qa/2026-10-14-northgate-demo");
  check(qaRow?.kind === "qa" && qaRow.verdict === "LAUNCH BLOCKED" && qaRow.status === "unread", `QA report listed with its verdict (${JSON.stringify(qaRow?.verdict)})`);
  const qaItem = (await call(q("qa/2026-10-14-northgate-demo"))).data;
  check(qaItem.shots.length === 1 && /sig=/.test(qaItem.shots[0]), "QA screenshot gets a signed URL");
  const shot = await fetch(BASE + qaItem.shots[0], { headers: { "cf-access-jwt-assertion": OP } });
  check(shot.status === 200 && shot.headers.get("content-type") === "image/png", "signed URL serves the QA screenshot from private R2");
  check((await fetch(BASE + qaItem.shots[0])).status === 403, "QA screenshot without an Access JWT → 403");
  check((await call("/api/docs/review", { method: "POST", body: { path: "qa/2026-10-14-northgate-demo", sha: qaItem.doc.sha256, status: "approved" } })).status === 201, "QA report approved through the same review flow");
  rmSync(QA, { recursive: true, force: true });

  // ---- reviews:pull (read-only, local D1) -------------------------------------------------------------
  const sha2 = (await call(q(MSA_PATH))).data.doc.sha256;
  await call("/api/docs/review", { method: "POST", body: { path: MSA_PATH, sha: sha2, status: "changes_requested", note: "Add the GST number to Parties" } });
  await call("/api/docs/comments", { method: "POST", body: { path: MSA_PATH, sha: sha2, anchor: "parties", body: "Use the legal name, not the trading name" } });
  const pullOut = join(STATE, "pull.md");
  const before = JSON.stringify((await call("/api/docs")).data);
  const pull = spawnSync("node", ["scripts/reviews-pull.mjs", "--persist-to", STATE, "--out", pullOut], { cwd: ROOT, env, encoding: "utf8" });
  const md = pull.status === 0 ? readFileSync(pullOut, "utf8") : pull.stderr;
  check(/Add the GST number/.test(md) && /#parties/.test(md) && /\*\*D1\*\*: amend — 8 \/ 7 in term/.test(md), "reviews:pull writes change requests, open comments and sign-offs");
  check(!/12 months, not 6/.test(md), "reviews:pull leaves out resolved comments");
  check(JSON.stringify((await call("/api/docs")).data) === before, "reviews:pull changed nothing");

  // ---- UI smoke --------------------------------------------------------------------------------------
  const { chromium } = await import(new URL("../runner/node_modules/playwright/index.mjs", import.meta.url).href);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ extraHTTPHeaders: { "cf-access-jwt-assertion": OP } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/documents`, { waitUntil: "networkidle" });
  check(await page.getByText("Test MSA").first().isVisible().catch(() => false), "UI /documents lists the doc");
  check(await page.getByText("changed since approved").first().isVisible().catch(() => false), "UI shows 'changed since approved'");
  await page.goto(`${BASE}/documents/view?path=${encodeURIComponent(MSA_PATH)}`, { waitUntil: "networkidle" });
  check(await page.locator("mark.doc-lawyer").count() === 2 && await page.locator("mark.doc-ph").count() >= 2, "UI highlights [LAWYER] and {PLACEHOLDER}");
  check(await page.locator("h2#liability-cap").count() === 1, "UI heading anchors match comment anchors");
  check(await page.locator("article script").count() === 0 && await page.getByText("<script>alert(1)</script>").first().isVisible().catch(() => false), "UI: raw HTML is shown as text, not rendered");
  await page.getByRole("button", { name: /Show diff/ }).click();
  check(await page.getByText("+ Capped at 12 months. [LAWYER]").first().isVisible().catch(() => false), "UI diff against last approved");
  await page.goto(`${BASE}/documents?tab=decisions`, { waitUntil: "networkidle" });
  check(await page.getByText("D7 · Guarantee").first().isVisible().catch(() => false), "UI Decisions tab shows cards");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(await page.getByText("changed since approval").first().isVisible().catch(() => false), "UI Today shows document counts");
  check(!errors.length, `UI: no console errors${errors.length ? ` (${errors.slice(0, 3).join(" | ")})` : ""}`);
  await browser.close();
} catch (e) {
  failures++;
  console.error("ERROR", e);
} finally {
  await stop();
  certs.close();
  // Put the real repo's bundle back.
  spawnSync("node", ["scripts/collect-docs.mjs"], { cwd: ROOT, env });
  await sleep(500);
  rmSync(STATE, { recursive: true, force: true });
  rmSync(FIX, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);

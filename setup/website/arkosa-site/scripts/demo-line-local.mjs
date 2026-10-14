#!/usr/bin/env node
/**
 * Local end-to-end test of the demo line. Nothing leaves this Mac:
 *   - a mock Twilio API on 127.0.0.1 records the texts the functions try to send
 *   - `wrangler pages dev` runs functions/api/twilio/* against a throwaway local D1
 *   - `wrangler dev` runs ../arkosa-alerts, whose send_email is simulated locally
 * Requests are signed the way Twilio signs them. Fictional 555-01xx numbers only.
 *
 *   npm run build   (once, so ./out exists)
 *   node scripts/demo-line-local.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE = new URL("..", import.meta.url).pathname;
const ALERTS_CFG = join(SITE, "../arkosa-alerts/wrangler.toml");
const STATE = mkdtempSync(join(tmpdir(), "demo-line-"));
const TOKEN = "local-test-token";
const SID = "AClocaltest";
const DEMO = "+13065550199";
const PAGES_PORT = 8791, ALERTS_PORT = 8792, INSPECT = 9331;
const N = (i) => `+1306555${String(100 + i).padStart(4, "0")}`; // +13065550101 …

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };

// ---- mock Twilio --------------------------------------------------------------------
const sent = [];
const mock = http.createServer((req, res) => {
  let b = "";
  req.on("data", (d) => (b += d));
  req.on("end", () => {
    const p = new URLSearchParams(b);
    sent.push({ to: p.get("To"), from: p.get("From"), body: p.get("Body"), at: Date.now() });
    res.writeHead(201, { "content-type": "application/json" }).end('{"sid":"SMmock"}');
  });
});
await new Promise((r) => mock.listen(0, "127.0.0.1", r));
const MOCK = `http://127.0.0.1:${mock.address().port}`;

// ---- wrangler processes ---------------------------------------------------------------
const procs = [];
let alertsLog = "";
function start(args, onOut) {
  const p = spawn("npx", ["--no-install", "wrangler", ...args], { cwd: SITE, env, stdio: ["ignore", "pipe", "pipe"] });
  p.stdout.on("data", (d) => onOut?.(String(d)));
  p.stderr.on("data", (d) => onOut?.(String(d)));
  procs.push(p);
  return p;
}
async function waitUp(url) {
  for (let i = 0; i < 120; i++) {
    try { await fetch(url); return; } catch { await sleep(500); }
  }
  throw new Error(`${url} never came up`);
}
const stop = async (p) => { p.kill("SIGINT"); await new Promise((r) => p.once("exit", r)); };

function startPages(caps) {
  const vars = {
    TWILIO_AUTH_TOKEN: TOKEN, TWILIO_ACCOUNT_SID: SID, TWILIO_DEMO_NUMBER: DEMO,
    PHONE_HASH_KEY: "local-hash-key", TWILIO_API_BASE: MOCK, ...caps,
  };
  return start(["pages", "dev", "./out", "--port", String(PAGES_PORT), "--inspector-port", String(INSPECT),
    "--persist-to", STATE, ...Object.entries(vars).flatMap(([k, v]) => ["--binding", `${k}=${v}`])]);
}

// ---- Twilio-style requests -----------------------------------------------------------------
const BASE = `http://127.0.0.1:${PAGES_PORT}`;
const sign = (url, params) =>
  createHmac("sha1", TOKEN).update(url + Object.keys(params).sort().map((k) => k + params[k]).join("")).digest("base64");
async function twilio(path, params, { signature } = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature ?? sign(url, params) },
    body: new URLSearchParams(params),
  });
  return { status: res.status, body: await res.text() };
}
let sid = 0;
const call = (from) => twilio("/api/twilio/voice", { CallSid: `CA${++sid}`, From: from, To: DEMO, CallStatus: "ringing" });
const text = (from, Body, extra = {}) => twilio("/api/twilio/sms", { MessageSid: `SM${++sid}`, From: from, To: DEMO, Body, ...extra });

/** Waits up to 10 s for a new text to `to`; returns it with the delay in ms, or null. */
async function textTo(to, since, ms = 10_000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) {
    const m = sent.find((s) => s.to === to && s.at >= since);
    if (m) return { ...m, delay: m.at - since };
  }
  return null;
}
const noTextTo = async (to, since) => !(await textTo(to, since, 2500));

function d1(sql) {
  const r = spawnSync("npx", ["--no-install", "wrangler", "d1", "execute", "arkosa", "--local", "--persist-to", STATE, "--json", "--command", sql],
    { cwd: SITE, env, encoding: "utf8" });
  const out = r.stdout.slice(r.stdout.indexOf("["));
  return JSON.parse(out)[0].results;
}
const alertCount = (re) => (alertsLog.match(new RegExp(re, "g")) ?? []).length;

// ---- run ------------------------------------------------------------------------------------
try {
  const mig = spawnSync("npx", ["--no-install", "wrangler", "d1", "migrations", "apply", "arkosa", "--local", "--persist-to", STATE],
    { cwd: SITE, env, encoding: "utf8" });
  check(mig.status === 0, "local D1 migrations 0001 + 0002 apply");

  start(["dev", "-c", ALERTS_CFG, "--port", String(ALERTS_PORT), "--inspector-port", String(INSPECT + 1),
    "--persist-to", STATE, "--var", "ALERT_TO:operator@example.com"], (s) => (alertsLog += s));
  await waitUp(`http://127.0.0.1:${ALERTS_PORT}/`);

  let pages = startPages({ DEMO_SMS_PER_DAY: "4", DEMO_SMS_PER_MONTH: "100", DEMO_SMS_CALLER_WINDOW_MIN: "10" });
  await waitUp(`${BASE}/`);
  await sleep(1500); // let the dev registry connect the ALERTS service binding

  // Signature gate
  check((await twilio("/api/twilio/voice", { From: N(1), To: DEMO }, { signature: "" })).status === 403, "unsigned call webhook → 403");
  check((await twilio("/api/twilio/voice", { From: N(1), To: DEMO }, { signature: "Zm9yZ2Vk" })).status === 403, "forged signature → 403");
  check((await twilio("/api/twilio/sms", { From: N(1), To: DEMO, Body: "hi" }, { signature: "Zm9yZ2Vk" })).status === 403, "forged SMS webhook → 403");

  // Text-back
  let t0 = Date.now();
  const r1 = await call(N(1));
  check(r1.status === 200 && r1.body.includes('<Reject reason="busy"/>') && !r1.body.includes("<Say"), "call is rejected busy (never answered)");
  const m1 = await textTo(N(1), t0);
  check(!!m1, `text-back sent to caller 1${m1 ? ` in ${m1.delay} ms` : ""}`);
  check(m1 && m1.delay < 10_000, "text-back under 10 s");
  check(m1?.body === "Sorry we missed you, this is Northgate Heating. What's going on with your furnace? Reply STOP to opt out.", "text-back wording");
  check(m1?.from === DEMO, "sent from the demo number");

  t0 = Date.now(); await call(N(1));
  check(await noTextTo(N(1), t0), "second call within 10 min → no second text");

  // One canned reply, then silence
  const rep = await text(N(1), "furnace is blowing cold air");
  check(rep.body.includes("<Message>Northgate Heating: thanks, a tech will call you back within 15 min."), "reply → one canned follow-up naming the business");
  check(!(await text(N(1), "hello?")).body.includes("<Message>"), "second reply → silence");
  check(!(await text(N(9), "who is this")).body.includes("<Message>"), "text from someone who never called → silence");

  // STOP / START
  await text(N(2), "STOP", { OptOutType: "STOP" });
  t0 = Date.now(); await call(N(2));
  check(await noTextTo(N(2), t0), "after STOP, a call gets no text");
  await text(N(2), "START", { OptOutType: "START" });
  t0 = Date.now(); await call(N(2));
  check(!!(await textTo(N(2), t0)), "after START, texts resume");

  // Daily cap: 4 texts so far would be 1 (N1) + 1 reply + 1 (N2) = 3; one more fills it.
  t0 = Date.now(); await call(N(3));
  check(!!(await textTo(N(3), t0)), "4th text of the day goes out");
  t0 = Date.now(); await call(N(4));
  check(await noTextTo(N(4), t0), "daily cap: 5th text blocked");
  await sleep(1500);
  t0 = Date.now(); await call(N(5));
  check(await noTextTo(N(5), t0), "daily cap: still blocked");
  await sleep(1500);
  check(alertCount("Demo line: daily cap hit") === 1, `daily cap → exactly one alert email (saw ${alertCount("Demo line: daily cap hit")})`);
  check(!(await text(N(3), "no heat")).body.includes("<Message>"), "daily cap also blocks the canned reply");

  // Monthly cap: restart with room for the day but the month already at 4.
  await stop(pages);
  pages = startPages({ DEMO_SMS_PER_DAY: "100", DEMO_SMS_PER_MONTH: "4", DEMO_SMS_CALLER_WINDOW_MIN: "10" });
  await waitUp(`${BASE}/`);
  await sleep(1500);
  t0 = Date.now(); await call(N(6));
  check(await noTextTo(N(6), t0), "monthly cap blocks a text even with daily room");
  t0 = Date.now(); await call(N(7));
  await noTextTo(N(7), t0);
  await sleep(1500);
  check(alertCount("Demo line: monthly cap hit") === 1, `monthly cap → exactly one alert email (saw ${alertCount("Demo line: monthly cap hit")})`);

  // What D1 holds
  const rows = d1("SELECT caller_hash, caller_last4, call_sid, sms_sent, skip_reason, reply_sent, carrier FROM demo_calls ORDER BY id");
  console.log("\ndemo_calls:");
  for (const r of rows) console.log(`  …${r.caller_last4}  hash ${r.caller_hash.slice(0, 8)}…  sms_sent=${r.sms_sent}  reply=${r.reply_sent}  skip=${r.skip_reason ?? "-"}`);
  console.log();
  check(rows.length === 9, `one demo_calls row per call (${rows.length})`);
  check(rows.every((r) => /^[0-9a-f]{64}$/.test(r.caller_hash) && /^\d{4}$/.test(r.caller_last4)), "callers stored as 64-hex hash + last 4");
  check(!JSON.stringify(d1("SELECT * FROM demo_calls")).match(/\+?1?306555\d{4}/) && !JSON.stringify(d1("SELECT * FROM demo_opt_outs")).match(/306555/), "no full phone number anywhere in D1");
  check(d1("SELECT COUNT(*) AS n FROM demo_alerts")[0].n === 2, "demo_alerts: one daily + one monthly row");
  check(sent.length === 3, `mock Twilio received exactly 3 text-backs (${sent.length}); replies go out as TwiML`);
} catch (e) {
  failures++;
  console.error("ERROR", e);
} finally {
  for (const p of procs) if (p.exitCode === null) p.kill("SIGINT");
  mock.close();
  await sleep(1000);
  rmSync(STATE, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);

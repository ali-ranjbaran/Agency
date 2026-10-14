#!/usr/bin/env node
/**
 * Self-test for qa-site: builds templates/site-starter twice in a temp folder OUTSIDE the repo
 *   control: as shipped
 *   broken:  privacy link removed from the footer, form posting to a wrong endpoint
 * serves each with `wrangler pages dev` (Turnstile TEST keys, local D1, a local CRM-capture
 * server), runs qa-site in client-staging mode, and checks the gate catches the breakage.
 *   node test/starter-selftest.mjs [--repo-root <Agency repo>]
 * Fictional data only (the starter's Northgate fixture). Nothing leaves this Mac except the
 * Turnstile test widget loading from Cloudflare.
 */
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const HERE = new URL("..", import.meta.url).pathname;
const ROOT = resolve(process.argv.includes("--repo-root") ? process.argv[process.argv.indexOf("--repo-root") + 1] : join(HERE, "../../../.."));
const STARTER = join(ROOT, "templates/site-starter");
const TMP = mkdtempSync(join(tmpdir(), "qa-selftest-"));
const TS_SITE = "1x00000000000000000000AA", TS_SECRET = "1x0000000000000000000000000000000AA"; // Cloudflare's always-pass test keys
const env = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false", NEXT_TELEMETRY_DISABLED: "1" };
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };
const run = (cmd, args, cwd, extra = {}) => { const r = spawnSync(cmd, args, { cwd, env: { ...env, ...extra }, encoding: "utf8", timeout: 600_000 }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed:\n${(r.stderr || r.stdout).slice(-1500)}`); return r.stdout; };

// CRM capture: stands in for the client's CRM webhook and records what arrives.
const captured = [];
const crm = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { captured.push(JSON.parse(b || "{}")); res.writeHead(200).end("ok"); }); });
await new Promise((r) => crm.listen(0, "127.0.0.1", r));
const CRM = `http://127.0.0.1:${crm.address().port}/hook`;

async function variant(name, port, breakIt) {
  const dir = join(TMP, name);
  cpSync(STARTER, dir, { recursive: true, filter: (src) => !/\/(node_modules|out|\.next|\.wrangler)(\/|$)/.test(src.slice(STARTER.length)) });
  symlinkSync(join(STARTER, "node_modules"), join(dir, "node_modules"));
  if (breakIt) {
    const footer = join(dir, "components/Footer.tsx");
    writeFileSync(footer, readFileSync(footer, "utf8").replace(/<p className="mt-2"><a href="\/privacy\/" className="link">Privacy<\/a><\/p>/, ""));
    const form = join(dir, "components/LeadForm.tsx");
    writeFileSync(form, readFileSync(form, "utf8").replace('fetch("/api/lead"', 'fetch("/api/lead-broken"'));
  }
  const origin = `http://127.0.0.1:${port}`;
  console.log(`\n== ${name}: build`);
  run("npm", ["run", "-s", "build"], dir, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: TS_SITE, NEXT_PUBLIC_SITE_URL: origin });
  const state = join(dir, ".wrangler-state");
  run("npx", ["--no-install", "wrangler", "d1", "migrations", "apply", "site-db", "--local", "--persist-to", state], dir);
  const bindings = { SITE_ORIGIN: origin, TURNSTILE_SECRET: TS_SECRET, IP_SALT: "selftest-salt", CRM_WEBHOOK_URL: CRM };
  const pages = spawn("npx", ["--no-install", "wrangler", "pages", "dev", "./out", "--ip", "127.0.0.1", "--port", String(port), "--persist-to", state,
    "--inspector-port", String(port + 1000), ...Object.entries(bindings).flatMap(([k, v]) => ["--binding", `${k}=${v}`])], { cwd: dir, env, stdio: "ignore" });
  for (let i = 0; i < 120; i++) { try { await fetch(origin); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
  console.log(`== ${name}: qa-site client-staging`);
  const out = join(TMP, `report-${name}`);
  const qa = spawn("node", ["qa.mjs", `${origin}/`, "--mode", "client-staging", "--allow-local", "--repo", dir, "--d1-local", state, "--out", out, "--max-pages", "8"], { cwd: HERE, env, stdio: ["ignore", "inherit", "inherit"] });
  const code = await new Promise((r) => qa.on("exit", r));
  pages.kill("SIGINT");
  const report = JSON.parse(readFileSync(join(out, "checks.json"), "utf8"));
  const st = (id) => report.checks.find((c) => c.id === id)?.status;
  return { code, st, report, out, firstLine: readFileSync(join(out, "report.md"), "utf8").split("\n")[0] };
}

try {
  const control = await variant("control", 8811, false);
  const leadsAtControl = captured.length;
  check(control.st("legal.privacy") === "PASS", `control: legal.privacy PASS (${control.st("legal.privacy")})`);
  check(control.st("form.e2e") === "PASS", `control: form.e2e PASS (${control.st("form.e2e")})`);
  check(control.st("form.guards") === "PASS", `control: form.guards PASS (${control.st("form.guards")})`);
  check(control.st("form.caps") === "PASS", `control: form.caps PASS (${control.st("form.caps")})`);
  const e2eEmail = (control.report.checks.find((c) => c.id === "form.e2e")?.evidence.join(" ").match(/qa-\d+@qa-test\.invalid/) ?? [])[0];
  check(!!e2eEmail && captured.some((l) => l.email === e2eEmail && l.name === "QA TEST, ignore"), `control: the e2e test lead ${e2eEmail} itself reached the CRM webhook (not just the cap probes)`);

  const broken = await variant("broken", 8812, true);
  check(broken.st("legal.privacy") === "FAIL", `broken: legal.privacy FAIL (${broken.st("legal.privacy")})`);
  check(broken.st("form.e2e") === "FAIL", `broken: form.e2e FAIL (${broken.st("form.e2e")})`);
  check(broken.code === 1 && broken.firstLine === "LAUNCH BLOCKED", `broken: exit 1 and first line "LAUNCH BLOCKED" (exit ${broken.code}, "${broken.firstLine}")`);
  check(captured.length === leadsAtControl, "broken: nothing reached the CRM");
  for (const [n, v] of [["control", control], ["broken", broken]]) {
    console.log(`\n${n}: ${v.firstLine} · ${JSON.stringify(v.report.counts)}`);
    for (const c of v.report.checks.filter((c) => c.status === "FAIL" || c.status === "UNVERIFIED")) console.log(`  ${c.status.padEnd(10)} ${c.id}: ${c.evidence.slice(0, 2).join(" · ").slice(0, 170)}`);
  }
  console.log(`\nreports: ${control.out}/report.md\n         ${broken.out}/report.md`);
} catch (e) {
  failures++;
  console.error("ERROR", e.message);
} finally {
  crm.close();
  if (!process.argv.includes("--keep")) rmSync(TMP, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : "\nself-test passed");
process.exit(failures ? 1 : 0);

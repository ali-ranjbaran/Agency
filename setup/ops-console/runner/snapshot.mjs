#!/usr/bin/env node
/**
 * Site snapshots for the console: homepage only, desktop 1440 and mobile 390 first screens,
 * signals, and Lighthouse mobile performance. Internal sales research: never published,
 * never reused in a rebuild.
 *
 *   node snapshot.mjs                    nightly: up to 25 sites with no snapshot in 30 days
 *   node snapshot.mjs --company 12       one company now
 *   node snapshot.mjs --url https://x --out /tmp/shot   local dry run, nothing uploaded
 *
 * Manners: honest user agent with a contact URL, robots.txt respected, one site at a time,
 * SNAPSHOT_DELAY_SEC (20) between sites, ~/.arkosa/snapshot-skip.txt honoured. No clicks,
 * no form input, no logins. Uploads go through the console (its R2 binding), so this Mac
 * holds no R2 keys.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { UA_SNAPSHOT, loadConfig, log, opsClient, robotsAllows, skipList, sleep } from "./lib.mjs";
import { pageSignals } from "./signals.mjs";

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

async function shoot(browser, url, viewport, isMobile) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1, userAgent: UA_SNAPSHOT, locale: "en-CA", serviceWorkers: "block" });
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(2500);
    const img = await page.screenshot({ type: "jpeg", quality: 70, animations: "disabled", caret: "hide", fullPage: false });
    const signals = isMobile ? await page.evaluate(pageSignals) : null;
    return { img, signals, finalUrl: page.url(), status: res?.status() ?? 0 };
  } finally {
    await ctx.close();
  }
}

/** Lighthouse mobile performance (its default config is mobile), on Playwright's Chromium. */
async function lighthousePerf(url) {
  const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-first-run"] });
  try {
    const r = await lighthouse(url, { port: chrome.port, onlyCategories: ["performance"], logLevel: "error", output: "json" });
    const score = r?.lhr?.categories?.performance?.score;
    return typeof score === "number" ? Math.round(score * 100) : null;
  } catch (e) {
    log("lighthouse failed", url, e.message);
    return null;
  } finally {
    await chrome.kill();
  }
}

/** `target` is a bare domain (→ https://domain/) or a full URL (dry runs, local tests). */
export async function snapshotOne(browser, target) {
  const url = /^https?:\/\//.test(target) ? target : `https://${target}/`;
  if (skipList().has(new URL(url).hostname.replace(/^www\./, ""))) return { error: "skip_list" };
  if (!(await robotsAllows(url, UA_SNAPSHOT))) return { error: "robots_disallowed" };
  try {
    const desktop = await shoot(browser, url, { width: 1440, height: 900 }, false);
    const mobile = await shoot(browser, url, { width: 390, height: 844 }, true);
    if (mobile.status >= 400) return { error: `http_${mobile.status}` };
    const lh = await lighthousePerf(mobile.finalUrl);
    return {
      desktop: desktop.img, mobile: mobile.img,
      meta: { url: mobile.finalUrl, https: mobile.finalUrl.startsWith("https:"), lh_mobile_perf: lh, ...mobile.signals },
    };
  } catch (e) {
    return { error: String(e.message).split("\n")[0].slice(0, 120) };
  }
}

async function upload(api, companyId, r) {
  const form = new FormData();
  form.set("company_id", String(companyId));
  form.set("meta", JSON.stringify(r.error ? { error: r.error } : r.meta));
  if (r.desktop) form.set("desktop", new Blob([r.desktop], { type: "image/jpeg" }), "desktop.jpg");
  if (r.mobile) form.set("mobile", new Blob([r.mobile], { type: "image/jpeg" }), "mobile.jpg");
  return api("/api/runner/snapshots", { method: "POST", form });
}

/** Snapshots a list of {id, domain}, one at a time, with the polite delay between sites. */
export async function snapshotTargets(api, targets, delaySec) {
  const browser = await chromium.launch();
  try {
    for (const [i, t] of targets.entries()) {
      if (i) await sleep(delaySec * 1000);
      const r = await snapshotOne(browser, t.domain);
      await upload(api, t.id, r);
      log(r.error ? `snapshot ${t.domain}: ${r.error}` : `snapshot ${t.domain}: perf ${r.meta.lh_mobile_perf}, tel ${r.meta.tel_link}, above fold ${r.meta.phone_above_fold_mobile}, form ${r.meta.form}`);
    }
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  if (arg("--url")) {
    const out = arg("--out") ?? "./snapshot-out";
    const browser = await chromium.launch();
    const r = await snapshotOne(browser, arg("--url"));
    await browser.close();
    mkdirSync(out, { recursive: true });
    if (r.desktop) writeFileSync(join(out, "desktop.jpg"), r.desktop);
    if (r.mobile) writeFileSync(join(out, "mobile.jpg"), r.mobile);
    writeFileSync(join(out, "meta.json"), JSON.stringify(r.error ? { error: r.error } : r.meta, null, 2));
    log(`dry run written to ${out}`, r.error ?? JSON.stringify(r.meta));
  } else {
    const api = opsClient(cfg);
    const company = arg("--company");
    const { targets } = await api(`/api/runner/targets${company ? `?company=${encodeURIComponent(company)}` : ""}`);
    log(`${targets.length} site(s) to snapshot`);
    await snapshotTargets(api, targets, cfg.delaySec);
  }
}

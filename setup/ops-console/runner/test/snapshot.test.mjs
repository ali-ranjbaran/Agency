// Real Playwright + Lighthouse against the local fixture sites (fictional firms, 127.0.0.1).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { snapshotOne } from "../snapshot.mjs";
import { startFixtures } from "./fixtures.mjs";

let fx, browser;
before(async () => { fx = await startFixtures(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await fx.close(); });

test("good site: tel link above the fold, form, two JPEG screenshots, Lighthouse score", { timeout: 120_000 }, async () => {
  const r = await snapshotOne(browser, `${fx.base}/good/`);
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.meta.tel_link, true);
  assert.equal(r.meta.phone_above_fold_mobile, true);
  assert.equal(r.meta.form, true);
  assert.equal(r.meta.https, false); // fixture is http
  assert.ok(r.desktop[0] === 0xff && r.desktop[1] === 0xd8, "desktop is a JPEG");
  assert.ok(r.mobile[0] === 0xff && r.mobile[1] === 0xd8, "mobile is a JPEG");
  assert.ok(Number.isInteger(r.meta.lh_mobile_perf) && r.meta.lh_mobile_perf >= 0 && r.meta.lh_mobile_perf <= 100, `perf ${r.meta.lh_mobile_perf}`);
});

test("bad site: phone only as text below the fold, no tel link, no form", { timeout: 120_000 }, async () => {
  const r = await snapshotOne(browser, `${fx.base}/bad/`);
  assert.equal(r.meta.tel_link, false);
  assert.equal(r.meta.phone_above_fold_mobile, false);
  assert.equal(r.meta.form, false);
});

test("honest user agent, and robots.txt is respected", { timeout: 60_000 }, async () => {
  const r = await snapshotOne(browser, `${fx.base}/blocked/`);
  assert.equal(r.error, "robots_disallowed");
  assert.ok(!fx.hits.some((h) => h.path === "/blocked/"), "the blocked page was never requested");
  const pageHits = fx.hits.filter((h) => h.path === "/good/" && /ArkosaSiteCheck/.test(h.ua ?? ""));
  assert.ok(pageHits.length >= 2, "desktop + mobile requests carried the ArkosaSiteCheck user agent");
});

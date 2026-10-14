// node --test skills/_shared/site-checks/test/   (fictional fixture only)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { assertPublicUrl, safeGet } from "../fetch.mjs";
import { parsePage, robotsTxt, sitemapXml, telValid, httpsRedirect } from "../page-checks.mjs";
import { detect } from "../detect.mjs";
import { serveFixtures } from "./serve-fixtures.mjs";
import { readFileSync } from "node:fs";

let fx;
before(async () => { fx = await serveFixtures(); });
after(async () => { await fx.close(); });
const HTML = readFileSync(new URL("./fixtures/index.html", import.meta.url), "utf8");

test("SSRF guard: local and odd-port URLs refused unless allowLocal", async () => {
  for (const u of ["http://127.0.0.1/", "http://localhost/", "http://10.0.0.5/", "http://169.254.169.254/latest", "https://example.com:8443/", "ftp://example.com/", "https://user:pw@example.com/"]) {
    await assert.rejects(assertPublicUrl(u), undefined, u);
  }
  assert.equal((await assertPublicUrl(`${fx.base}/`, { allowLocal: true })).origin, fx.base);
});

test("parsePage reads the facts both skills use", () => {
  const p = parsePage(HTML);
  assert.match(p.title, /^Furnace Repair in Saskatoon/);
  assert.ok(p.metaDesc && p.viewport && p.ogTitle && p.ogImage === "/og.png" && p.canonical === "/");
  assert.deepEqual(p.localBusiness, ["HVACBusiness"]);
  assert.equal(p.telLinks[0].href, "tel:+13065550123");
  assert.equal(p.privacyLink.href, "/privacy");
  assert.equal(p.termsLink, null);
  assert.deepEqual(parsePage('<script type="application/ld+json">{"@type":"Organization"}</script>').localBusiness, []);
  assert.deepEqual(parsePage('<script type="application/ld+json">{"@type":"ProfessionalService"}</script>').localBusiness, ["ProfessionalService"]);
});

test("telValid", () => {
  for (const ok of ["tel:+13065550123", "tel:306-555-0123", "tel:13065550123"]) assert.ok(telValid(ok), ok);
  for (const bad of ["tel:555-0123", "tel:+441234567890", "tel:", "tel:0065550123"]) assert.ok(!telValid(bad), bad);
});

test("robots.txt and sitemap.xml against the fixture", async () => {
  const r = await robotsTxt(fx.base, { allowLocal: true });
  assert.equal(r.ok, true); assert.equal(r.data.disallowAll, false);
  const s = await sitemapXml(fx.base, { allowLocal: true });
  assert.equal(s.ok, true); assert.deepEqual(s.data.urls, ["/"]);
});

test("httpsRedirect: an http site is reported as such", async () => {
  const r = await httpsRedirect(new URL(fx.base), { allowLocal: true });
  assert.equal(r.ok, false); assert.match(r.evidence, /plain http/);
});

test("safeGet follows redirects only through allowed hosts, HEAD supported", async () => {
  const r = await safeGet(`${fx.base}/`, { allowLocal: true, method: "HEAD", maxBytes: 1 });
  assert.equal(r.status, 200);
});

test("detect: vendor fingerprints", () => {
  assert.deepEqual(detect(HTML, "analytics"), ["Google Analytics 4"]);
  assert.deepEqual(detect("<script src=https://cdn.callrail.com/x.js>", "callTracking"), ["CallRail"]);
});

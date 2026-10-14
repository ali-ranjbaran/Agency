// Enrichment against the local fixture sites (fictional firms on 127.0.0.1).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { enrichSite, emailFlags, politeFetcher, pickLinks } from "../enrich.mjs";
import { parse } from "node-html-parser";
import { startFixtures } from "./fixtures.mjs";

let fx;
before(async () => { fx = await startFixtures(); });
after(async () => { await fx.close(); });
const quick = () => politeFetcher({ delayMs: 20 });

test("good site: name, phone, city, published emails with the exact source page, owner only when stated", async () => {
  const r = await enrichSite(`${fx.base}/good/`, { fetcher: quick() });
  assert.equal(r.ok, true);
  assert.equal(r.name, "Northgate Heating & Air");
  assert.equal(r.phone, "+13065550123");
  assert.equal(r.city, "Saskatoon");
  assert.equal(r.segment, "mixed"); // homes + small businesses
  assert.equal(r.enrichment.claims_247, true);
  assert.deepEqual(r.enrichment.services.slice(0, 3), ["furnace", "boiler", "air conditioning"]);
  const office = r.contacts.find((c) => c.email === "office@northgate.example");
  const pat = r.contacts.find((c) => c.email === "pat@northgate.example");
  assert.equal(office.source_url, `${fx.base}/good/contact`);
  assert.deepEqual(office.flags, ["role"]);
  assert.equal(pat.name, "Pat Example");
  assert.match(pat.title, /Owner/);
  assert.match(pat.no_refusal_checked_where, /none found/);
  assert.equal(pat.refusal_found, null);
  assert.match(pat.relevance_rationale, /Northgate Heating & Air/);
  for (const c of r.contacts) for (const k of ["source_url", "capture_date", "no_refusal_checked_where", "relevance_rationale"]) assert.ok(c[k], `${c.email} ${k}`);
});

test("never opens login pages, never leaves the site, max 4 pages", async () => {
  const before = fx.hits.length;
  const r = await enrichSite(`${fx.base}/good/`, { fetcher: quick() });
  const paths = fx.hits.slice(before).map((h) => h.path).filter((p) => p !== "/robots.txt");
  assert.ok(!paths.includes("/good/login"), "login page not fetched");
  assert.ok(paths.length <= 4 && r.enrichment.pages.length <= 4, `pages: ${paths.join(", ")}`);
  assert.ok(fx.hits.slice(before).every((h) => /^ArkosaLeadResearch\/1\.0 \(\+https:\/\/thearkosa\.com\)$/.test(h.ua)), "honest user agent on every request");
});

test("bad site: free-mail flagged, commercial segment, phone from text", async () => {
  const r = await enrichSite(`${fx.base}/bad/`, { fetcher: quick() });
  const g = r.contacts.find((c) => c.email === "fictional.prairie.4f9c@gmail.com");
  assert.deepEqual(g.flags, ["freemail"]);
  assert.equal(r.segment, "commercial");
  assert.equal(r.phone, "+13065550124");
});

test("a refusal statement anywhere on the firm's site blocks the contact, and says where", async () => {
  const r = await enrichSite(`${fx.base}/noscrape/`, { fetcher: quick() });
  const c = r.contacts.find((x) => x.email === "info@noscrape.example");
  assert.equal(c.source_url, `${fx.base}/noscrape/`, "source page = where the email first appears");
  assert.ok(c.refusal_found?.includes(`${fx.base}/noscrape/contact`) && /unsolicited/.test(c.refusal_found), c.refusal_found);
  assert.match(c.no_refusal_checked_where, /refusal statement found on .*\/noscrape\/contact/);
});

test("robots.txt Disallow is respected", async () => {
  const before = fx.hits.length;
  const r = await enrichSite(`${fx.base}/private/x`, { fetcher: quick() });
  assert.equal(r.ok, false);
  assert.equal(r.error, "robots_disallowed");
  assert.ok(!fx.hits.slice(before).some((h) => h.path === "/private/x"));
});

test("1 request per 2 s per domain (default fetcher)", { timeout: 30_000 }, async () => {
  const get = politeFetcher();
  const before = fx.hits.length;
  await get(`${fx.base}/good/`); await get(`${fx.base}/good/about`); await get(`${fx.base}/good/services`);
  const t = fx.hits.slice(before).filter((h) => h.path !== "/robots.txt").map((h) => h.at);
  assert.equal(t.length, 3);
  assert.ok(t[1] - t[0] >= 1950 && t[2] - t[1] >= 1950, `gaps ${t[1] - t[0]} ms, ${t[2] - t[1]} ms`);
});

test("role / free-mail / ISP flags", () => {
  assert.deepEqual(emailFlags("info@x.example"), ["role"]);
  assert.deepEqual(emailFlags("office@gmail.com"), ["role", "freemail"]);
  assert.deepEqual(emailFlags("fictional.4f9c@sasktel.net"), ["isp"]);
  assert.deepEqual(emailFlags("pat.example@northgate.example"), []);
});

test("link picker: same host only, skips login and files", () => {
  const root = parse(`<a href="/contact">Contact</a><a href="https://other.example/about">About</a><a href="/my-account">Account</a><a href="/about-us">About us</a><a href="/brochure.pdf">Services PDF</a><a href="/services">Services</a>`);
  assert.deepEqual(pickLinks(root, "https://northgate.example/"), ["https://northgate.example/contact", "https://northgate.example/about-us", "https://northgate.example/services"]);
});

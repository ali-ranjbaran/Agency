/**
 * Crawl + per-page evidence with Playwright: status, headers, HTML facts (shared parsePage),
 * axe-core WCAG 2.1 AA, screenshots at 375 / 768 / 1280, overflow at 375, tel: tap target in the
 * first mobile screen, and a request log. One page at a time, honest user agent.
 */
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { parsePage } from "../../../../_shared/site-checks/page-checks.mjs";

export const UA = "Mozilla/5.0 (compatible; ArkosaQA/1.0; +https://thearkosa.com)";
export const WIDTHS = [375, 768, 1280];
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const SKIP = /\.(pdf|jpe?g|png|gif|webp|avif|svg|zip|docx?|xlsx?|mp4|mov)$/i;

/** Same-origin URLs to check: home, sitemap URLs, links found on the home page. Max `max`. */
export function pickPages(origin, homeLinks, sitemapUrls, max = 25) {
  const seen = new Set();
  const out = [];
  const push = (u) => {
    try {
      const x = new URL(u, origin);
      if (x.origin !== origin || SKIP.test(x.pathname)) return;
      x.hash = ""; x.search = "";
      const key = x.pathname.replace(/\/$/, "") || "/";
      if (seen.has(key) || out.length >= max) return;
      seen.add(key); out.push(x.href);
    } catch {}
  };
  push(`${origin}/`);
  for (const u of sitemapUrls ?? []) push(u);
  for (const u of homeLinks ?? []) push(u);
  return out;
}

export async function newContext(browser, { credentials, width = 1280 } = {}) {
  return browser.newContext({
    userAgent: UA, viewport: { width, height: width <= 400 ? 812 : 900 }, isMobile: width <= 400, hasTouch: width <= 400,
    ...(credentials ? { httpCredentials: credentials } : {}), serviceWorkers: "block", locale: "en-CA",
  });
}

/** Visits one page and gathers everything the checks need. */
export async function inspectPage(browser, url, { credentials, shotDir, index }) {
  const ctx = await newContext(browser, { credentials, width: 1280 });
  const page = await ctx.newPage();
  const requests = [];
  page.on("requestfinished", async (r) => { const res = await r.response().catch(() => null); requests.push({ url: r.url(), method: r.method(), type: r.resourceType(), status: res?.status() ?? null }); });
  page.on("requestfailed", (r) => requests.push({ url: r.url(), method: r.method(), type: r.resourceType(), status: null, failure: r.failure()?.errorText }));
  const out = { url, requests, shots: {}, overflow375: null, telAboveFold375: null };
  try {
    const res = await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    out.status = res?.status() ?? 0;
    out.finalUrl = page.url();
    out.headers = res ? await res.allHeaders() : {};
    out.html = await page.content();
    out.facts = parsePage(out.html);
    out.links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
    out.bannerText = await page.$$eval('[role="note"]', (ns) => ns.map((n) => n.textContent ?? "").join(" ")).catch(() => "");
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    out.axe = axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, targets: v.nodes.map((n) => n.target.join(" ")).slice(0, 5), count: v.nodes.length }));
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w <= 400 ? 812 : w <= 800 ? 1024 : 900 });
      await page.waitForTimeout(300);
      if (w === 375) {
        out.overflow375 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        out.telAboveFold375 = await page.evaluate(() => [...document.querySelectorAll('a[href^="tel:"]')].some((a) => {
          const r = a.getBoundingClientRect(); const s = getComputedStyle(a);
          return r.width > 0 && r.height > 0 && r.top >= 0 && r.top < window.innerHeight && s.visibility !== "hidden" && s.display !== "none";
        }));
      }
      const path = join(shotDir, `${String(index).padStart(2, "0")}-${new URL(url).pathname.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${w}.png`);
      await page.screenshot({ path, fullPage: true, animations: "disabled", caret: "hide" });
      out.shots[w] = path;
    }
  } catch (e) {
    out.error = String(e.message).split("\n")[0];
  } finally {
    await ctx.close();
  }
  return out;
}

/**
 * Lighthouse on Playwright's Chromium. Default settings are mobile (formFactor 'mobile', simulated
 * throttling, mobile screen emulation; lighthouse/core/config/constants.js). Records all four
 * category scores; the gate is mobile performance ≥ 90.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

export async function runLighthouse(url, { extraHeaders, jsonPath } = {}) {
  const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-first-run"] });
  try {
    const r = await lighthouse(url, {
      port: chrome.port, logLevel: "error", output: "json",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      ...(extraHeaders ? { extraHeaders } : {}),
    });
    const lhr = r?.lhr;
    if (!lhr) return { error: "no Lighthouse result" };
    if (jsonPath) writeFileSync(jsonPath, JSON.stringify(lhr));
    const s = (k) => (lhr.categories[k]?.score == null ? null : Math.round(lhr.categories[k].score * 100));
    return {
      performance: s("performance"), accessibility: s("accessibility"), bestPractices: s("best-practices"), seo: s("seo"),
      formFactor: lhr.configSettings?.formFactor, runtimeError: lhr.runtimeError?.message ?? null,
      lcpMs: lhr.audits["largest-contentful-paint"]?.numericValue ?? null,
      opportunities: Object.values(lhr.audits).filter((a) => a.details?.type === "opportunity" && (a.score ?? 1) < 0.9).map((a) => a.title).slice(0, 5),
    };
  } catch (e) {
    return { error: String(e.message).split("\n")[0] };
  } finally {
    await chrome.kill();
  }
}

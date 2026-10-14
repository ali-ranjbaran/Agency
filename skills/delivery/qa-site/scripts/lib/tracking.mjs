/**
 * Consent + tracking, observed in network requests (not "the code looks right").
 *   1. A fresh browser (no stored choices) loads the home page; every request is recorded.
 *      A non-essential request before any consent click → consent FAIL.
 *   2. If a consent banner is found, its accept button is clicked; requests are recorded again.
 *      Analytics / call-tracking requests seen after consent → firing.
 */
import { newContext } from "./browse.mjs";

// Hosts/paths that are non-essential (analytics, ads, pixels, session replay, chat, call tracking).
const NON_ESSENTIAL = [
  /googletagmanager\.com/, /google-analytics\.com/, /analytics\.google\.com/, /doubleclick\.net/, /googleadservices\.com/,
  /connect\.facebook\.net/, /facebook\.com\/tr/, /clarity\.ms/, /hotjar\.(com|io)/, /static\.hotjar/, /tiktok\.com\/i18n|analytics\.tiktok/,
  /snap\.licdn\.com|px\.ads\.linkedin/, /bat\.bing\.com/, /callrail\.com|cdn\.callrail/, /calltrackingmetrics|tctm\.co/, /whatconverts/,
  /podium\.com/, /tawk\.to/, /intercom(cdn)?\.(io|com)/, /widget\.drift|js\.driftt/, /livechatinc/, /leadconnectorhq\.com\/.*chat/,
];
// A hit = data actually sent (collect/beacon), not just the tag script loading.
const ANALYTICS_HIT = [/google-analytics\.com\/(g\/)?collect/, /analytics\.google\.com\/g\/collect/, /region\d+\.google-analytics\.com\/g\/collect/, /facebook\.com\/tr\b/, /clarity\.ms\/collect/, /plausible\.io\/api\/event/];
const CALLTRACK_HIT = [/callrail\.com|cdn\.callrail/, /calltrackingmetrics|tctm\.co/, /whatconverts/];

export async function observeTracking(browser, url, { credentials } = {}) {
  const ctx = await newContext(browser, { credentials, width: 1280 });
  const page = await ctx.newPage();
  const log = [];
  let phase = "before-consent";
  page.on("request", (r) => log.push({ phase, url: r.url(), type: r.resourceType() }));
  const out = { log, banner: null, accepted: false };
  try {
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const accept = page.getByRole("button", { name: /^(accept( all)?|allow( all)?|i agree|agree|yes[,.]?.*|ok(ay)?)\b/i }).first();
    if (await accept.isVisible().catch(() => false)) {
      out.banner = (await accept.textContent())?.trim() ?? "accept";
      phase = "after-consent";
      await accept.click();
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(4000);
      out.accepted = true;
    }
  } catch (e) {
    out.error = String(e.message).split("\n")[0];
  } finally {
    await ctx.close();
  }
  const nonEss = (l) => NON_ESSENTIAL.some((re) => re.test(l.url));
  out.beforeConsent = log.filter((l) => l.phase === "before-consent" && nonEss(l)).map((l) => l.url);
  out.afterConsent = log.filter((l) => l.phase === "after-consent" && nonEss(l)).map((l) => l.url);
  out.analyticsHits = log.filter((l) => ANALYTICS_HIT.some((re) => re.test(l.url))).map((l) => `${l.phase}: ${l.url.slice(0, 140)}`);
  out.callTrackingHits = log.filter((l) => CALLTRACK_HIT.some((re) => re.test(l.url))).map((l) => `${l.phase}: ${l.url.slice(0, 140)}`);
  return out;
}

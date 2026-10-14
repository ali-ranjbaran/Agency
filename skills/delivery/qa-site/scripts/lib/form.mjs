/**
 * Form end to end, through the real UI. Fills the lead form with a clearly MARKED test lead and
 * watches the network for the POST it makes:
 *   - POST answered 2xx              → submitted (then destination.mjs confirms arrival)
 *   - POST answered 4xx/5xx          → FAIL (broken endpoint, validation, CRM down…)
 *   - no POST, Turnstile on the page → the widget gave no token: bots are blocked by design → UNVERIFIED
 *   - no POST, no Turnstile          → FAIL (the form doesn't send)
 * Probes (refused-only): no Turnstile token, foreign Origin, oversized body. Nothing is stored.
 */
import { newContext } from "./browse.mjs";

export const TEST_PHONE = "306-555-0199";
export const testLead = (runId) => ({
  name: "QA TEST, ignore", company: "QA TEST, ignore", email: `qa-${runId}@qa-test.invalid`, phone: TEST_PHONE,
  message: "Automated launch check by Arkosa qa-site. Please ignore; this lead is archived automatically.",
});

/** Finds the page with the lead form: prefers /contact, else the first page with a real form. */
export function pickFormPage(pages) {
  const hasForm = (p) => /<form\b[\s\S]*?(type=["'](tel|email)["']|<textarea)/i.test(p.html ?? "");
  return pages.find((p) => /contact|quote|start/i.test(new URL(p.url).pathname) && hasForm(p)) ?? pages.find(hasForm) ?? null;
}

export async function submitThroughUi(browser, url, lead, { credentials } = {}) {
  const ctx = await newContext(browser, { credentials, width: 1280 });
  const page = await ctx.newPage();
  const out = { url, posted: null, turnstile: false };
  // Turnstile renders in a shadow root, so also watch the network for Cloudflare's challenge host.
  page.on("request", (r) => { if (/challenges\.cloudflare\.com/.test(r.url())) out.turnstile = true; });
  try {
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    out.turnstile ||= (await page.locator('iframe[src*="challenges.cloudflare.com"], .cf-turnstile, script[src*="challenges.cloudflare.com/turnstile"]').count()) > 0;
    await page.waitForTimeout(out.turnstile ? 6000 : 500); // give the widget its chance to issue a token
    const form = page.locator("form").filter({ has: page.locator('input[type="tel"], input[type="email"], textarea') }).first();
    if (!(await form.count())) { out.error = "no lead form found on the page"; return out; }
    for (const input of await form.locator("input, textarea, select").all()) {
      if (!(await input.isVisible().catch(() => false)) || !(await input.isEditable().catch(() => false))) continue;
      // Never fill a honeypot: a filled trap makes the site silently drop the lead (and fake a success).
      const trap = await input.evaluate((e) => {
        if (e.getAttribute("tabindex") === "-1" || e.closest('[aria-hidden="true"]')) return true;
        const r = e.getBoundingClientRect();
        return r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth + 1000 || r.width < 2 || r.height < 2;
      });
      if (trap || /^(website|url|homepage|hp|hp_.*|honeypot|fax|bot.*)$/i.test((await input.getAttribute("name")) ?? "")) continue;
      const name = ((await input.getAttribute("name")) ?? "").toLowerCase();
      const type = ((await input.getAttribute("type")) ?? "text").toLowerCase();
      const tag = await input.evaluate((e) => e.tagName);
      if (tag === "SELECT") { const v = await input.locator("option").evaluateAll((os) => os.map((o) => o.value).find((x) => x)); if (v) await input.selectOption(v); continue; }
      if (["hidden", "submit", "button", "checkbox", "radio", "file"].includes(type)) { if (type === "checkbox" && (await input.getAttribute("required")) !== null) await input.check(); continue; }
      const val = type === "email" || /mail/.test(name) ? lead.email : type === "tel" || /phone|tel/.test(name) ? lead.phone
        : /company|business|org/.test(name) ? lead.company : /city/.test(name) ? "Saskatoon" : tag === "TEXTAREA" || /message|note|detail/.test(name) ? lead.message : lead.name;
      await input.fill(val);
    }
    const posted = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).origin === new URL(url).origin, { timeout: 20_000 }).catch(() => null);
    await form.locator('button[type="submit"], input[type="submit"], button:not([type])').first().click({ timeout: 10_000 });
    const res = await posted;
    if (res) {
      let body = ""; try { body = (await res.text()).slice(0, 300); } catch {}
      out.posted = { endpoint: new URL(res.url()).pathname, status: res.status(), body };
    }
    out.visibleError = (await page.locator('[role="alert"]').allTextContents().catch(() => [])).join(" ").trim().slice(0, 200);
    if (/bot check|captcha|turnstile|verify (that )?you are human/i.test(out.visibleError)) out.turnstile = true;
  } catch (e) {
    out.error = String(e.message).split("\n")[0];
  } finally {
    await ctx.close();
  }
  return out;
}

/** Refused-only probes against the form endpoint. Every one must come back 4xx. */
export async function probeGuards(origin, endpoint, lead) {
  const post = (headers, body) => fetch(origin + endpoint, { method: "POST", headers: { "content-type": "application/json", ...headers }, body, signal: AbortSignal.timeout(15_000) })
    .then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 120) })).catch((e) => ({ status: 0, body: e.message }));
  const json = JSON.stringify({ ...lead, turnstile: "" });
  return {
    noToken: await post({ origin }, json),
    badOrigin: await post({ origin: "https://not-this-site.example" }, JSON.stringify({ ...lead, turnstile: "x" })),
    tooLarge: await post({ origin }, JSON.stringify({ ...lead, message: "x".repeat(30_000), turnstile: "x" })),
  };
}

/** Staging only (Turnstile test keys): sends marked leads until a 429 appears. */
export async function probeCaps(origin, endpoint, lead, maxTries = 6) {
  const tries = [];
  lead = { ...lead, name: "QA TEST cap probe, ignore", email: lead.email.replace("@", "-cap@") };
  for (let i = 0; i < maxTries; i++) {
    const r = await fetch(origin + endpoint, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify({ ...lead, turnstile: "XXXX.DUMMY.TOKEN.XXXX" }), signal: AbortSignal.timeout(15_000) })
      .then((x) => x.status).catch(() => 0);
    tries.push(r);
    if (r === 429) break;
  }
  return tries;
}

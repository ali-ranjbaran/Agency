# qa-site checks

Statuses: **PASS** (evidence shown) · **FAIL** (blocks launch) · **UNVERIFIED** (a human must
resolve it; never a pass) · **N/A** (doesn't apply in this mode, with the reason).
Modes: S = client-staging, P = production, V = prospect-preview.

| id | Standard | Modes | Evidence | Fix (when not PASS) |
|---|---|---|---|---|
| site.reachable | Every crawled page loads (2xx/3xx) | S P V | status per page | Fix the failing pages |
| perf.lighthouse | Lighthouse **mobile** performance ≥ 90 on home + form page; a11y / best practices / SEO recorded | S P | scores, LCP, `lighthouse-*.json` | Images, JS, fonts per the listed opportunities |
| a11y.axe | axe-core tags wcag2a/aa + wcag21a/aa: **zero serious or critical** on every page; minor/moderate listed | S P V | rule, impact, selectors, `axe.json` | Fix each violation |
| a11y.keyboard | Manual Tab pass: visible focus, logical order, no traps | S P V | `--confirm` note | Human |
| shots.breakpoints | Full-page screenshots at 375/768/1280 per page; no horizontal overflow at 375 | S P V | `screenshots/` | Constrain the overflowing element |
| form.e2e | A marked test lead submitted **through the UI** reaches its destination (D1 `leads` row, or a `forwarded` `sends` row = CRM webhook 2xx) | S P | POST status/body, D1 row | Endpoint / destination config |
| form.followup | The CRM follow-up fired for the test lead | S P | `--confirm` note | Human |
| form.guards | No-token, foreign-Origin and oversized POSTs are refused (4xx) | S P | three statuses | Add the guard |
| form.caps | Staging: a burst gets a 429. Production: caps read from config, live burst not sent | S (P = UNVERIFIED) | statuses, config | Add per-IP + daily caps |
| legal.privacy | Privacy page linked from **every** page and loads | S P V | pages missing it | Footer link |
| legal.consent | No non-essential request (analytics, pixels, chat, call tracking) before consent; N/A when none ever load | S P | `tracking.json` | Gate scripts on consent |
| legal.terms | Terms page linked, else UNVERIFIED (decide if needed) | P | link | Add or decide |
| track.analytics | Analytics **data sent** (collect/beacon) seen in network after consent. Installed but silent = FAIL; none = UNVERIFIED | S P | request URLs | Fix ID / gate / tag |
| track.calls | Call-tracking requests seen; installed but silent = FAIL; none = UNVERIFIED | S P | request URLs | Install or confirm none |
| seo.tel | ≥1 tel: link, all valid NANP, one tappable in the first 375 px screen | S P V | hrefs, tap target | `tel:+1…` in the mobile header |
| tel.device | tel: links tapped on a real phone | S P | `--confirm` note | Human |
| seo.meta | Title, meta description, og:title, og:image (loads 200), canonical on every page; production canonical same-origin | S P | per page | Add the tags |
| seo.robots | robots.txt 200; production must not `Disallow: /` | S P | status | Serve / fix robots.txt |
| seo.sitemap | sitemap.xml 200 with this origin's URLs | S P | URL count | Serve the sitemap |
| seo.indexable | Production pages carry no noindex | P | pages with noindex | Remove noindex |
| seo.localbusiness | LocalBusiness-type JSON-LD (LocalBusiness, ProfessionalService, HVACBusiness, Plumber, Electrician…) | P | schema types | Add JSON-LD with NAP |
| https.redirect | http → https; www and apex resolve to one host | P | hops | 301 both (Cloudflare Redirect Rule) |
| links.broken | Internal links 2xx/3xx; external (max 50) fail only on 404/410 | S P V | broken URLs | Fix links |
| secrets.output | No env values (.dev.vars/.env*, except NEXT_PUBLIC_*) or known secret formats in the build dir or anything served | S P V | file + kind (never the value) | Remove, rotate, rebuild |
| preview.access | No password → 401/403 | V | status | MOCK_PASSWORD / Access |
| preview.noindex | noindex on every page and robots `Disallow: /` | V | pages, robots | Serve both |
| preview.banner | PreviewBanner text on every page | V | pages | Render the banner |
| preview.form | The form endpoint refuses leads | V | status | Mock mode refuses |
| gbp | Google Business Profile claimed, NAP matches the site, links to it | P | `--confirm` note | Human |

## Lessons built in (don't undo)

- **Never fill a honeypot.** Fields with `tabindex="-1"`, `aria-hidden`, off-screen boxes or
  honeypot names are skipped. A filled honeypot makes a site answer `200 ok` and drop the lead,
  which looks like success.
- **Turnstile blocks automation on production by design.** It renders in a shadow root, so it's
  detected by requests to `challenges.cloudflare.com` and by "bot check" error text. Result:
  form.e2e UNVERIFIED with a hand-submit + `--confirm-lead` path, never FAIL. Staging uses the
  test keys (sitekey `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`).
- **A refused probe isn't a guard** if the endpoint answers 404/405 to everything: form.guards
  is UNVERIFIED until form.e2e works.
- **Loading the analytics tag isn't firing.** Only collect/beacon requests count.
- **Arrival reads retry** (6 × 2.5 s) before saying "not found".

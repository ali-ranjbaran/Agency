# site-checks (shared, not a skill)

Code used by more than one skill. No SKILL.md, so `install-skills.sh` doesn't link it; skills
import it by relative path (Node resolves the symlinked skill to its real path in this repo).

| File | Exports | Used by |
|---|---|---|
| `fetch.mjs` | `assertPublicUrl(url, {allowLocal})`, `safeGet(url, {method, userAgent, allowLocal, maxBytes, timeout})`, `UA`: public http(s) only, private/loopback/link-local refused at every redirect hop | audit-site (and its dashboard), qa-site |
| `html.mjs` | `decode`, `attrs`, `tags`, `blocks`, `textOf`, `has`, `PHONE_RE`: regex HTML helpers | audit-site, qa-site |
| `detect.mjs` | `DETECT`, `detect(html, group)`: analytics, consent, call tracking, CRM, booking, chat, reviews, builders | audit-site, qa-site |
| `page-checks.mjs` | `parsePage(html)` facts (title, meta, OG, canonical, robots meta, tel links, JSON-LD types, LocalBusiness, privacy/terms links); `telValid`; `robotsTxt`, `sitemapXml`, `httpsRedirect` → `{ok, evidence, data}` | qa-site (audit-site uses `parsePage`) |

**Rule:** nothing here decides a verdict. audit-site grades pass/warn/fail for a sales audit;
qa-site applies the launch standard (PASS/FAIL/UNVERIFIED/N/A). Change a fact-finder here and
both skills see it: run `node --test test/` and the audit-site regression in the commit notes.

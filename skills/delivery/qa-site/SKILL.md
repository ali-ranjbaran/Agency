---
name: qa-site
description: >
  The pre-launch gate for a website: runs Lighthouse, axe-core WCAG 2.1 AA, a marked test lead
  through the real form to its destination, privacy/consent, analytics and call tracking seen in
  network requests, tel links, SEO tags, robots/sitemap, broken links, screenshots at 375/768/1280,
  a secrets scan of the build, and prospect-preview privacy. Writes a PASS/FAIL/UNVERIFIED/N/A
  report with evidence; any FAIL means LAUNCH BLOCKED. Use whenever the operator says qa the site,
  is it ready to launch, run the pre-launch checks, check the site before we ship, can this go
  live, or build-site hands off — and before any mock link goes to a prospect.
---

# qa-site

The launch gate. "Done" means this report's first line is **CLEARED** (CLAUDE.md, Delivery
standards). It runs what it can, shows the evidence, and says plainly what a human must check.

## Triggers

- "qa the site", "is it ready to launch", "run the pre-launch checks", "check the site before we ship"
- "can this go live", "launch check for [client]", "QA the staging URL"
- build-site's handoff (§8), and before a prospect preview link is sent

## Hard rules

1. **Evidence or it isn't a PASS.** Never mark a check PASS because the code looks right.
2. **UNVERIFIED is never a pass.** Report it; don't round it up. The run isn't CLEARED until a
   human resolves it with `--confirm`.
3. **Never fix the site during a QA run.** Report, then fix in a separate step, then re-run.
4. **Only the requests in `references/checks.md` are sent.** On production: one marked test lead
   through the UI, three refused-only probes (no captcha token, foreign Origin, oversized body).
   The rate-cap burst runs only in client-staging.
5. **Test leads are always marked** (`QA TEST, ignore`, `qa-<run>@qa-test.invalid`, 555-01xx
   phone) and archived after the arrival check. Arkosa's lead runner skips that marker.
6. **Reports stay outside the repo:** `~/Arkosa-leads/qa/<date>-<domain>/`.

## Run it

One-time: `bash scripts/install.sh` (npm install + Playwright Chromium).

```bash
cd scripts
node qa.mjs <url> --mode client-staging   --repo <site repo>   # before launch, staging deploy
node qa.mjs <url> --mode production       --repo <site repo>   # after go-live
QA_PREVIEW_PASSWORD=… node qa.mjs <url> --mode prospect-preview  # mock links for prospects
```

| Mode | Use for | Differences |
|---|---|---|
| `client-staging` | the client's staging deploy | full form test (Turnstile **test keys** on staging), rate-cap burst probed |
| `production` | the live site | caps not probed; noindex must be absent; https/www, LocalBusiness, terms, GBP checked |
| `prospect-preview` | a private mock for a prospect | must be password-protected, noindex everywhere, PreviewBanner on every page, form refuses leads; FAIL if publicly indexable |

Options: `--repo` (needed to read D1 arrival, scan the build, read caps config) ·
`--max-pages 25` · `--confirm <id>="what you checked"` (repeatable) · `--confirm-lead <email>` ·
`--allow-local` (local test servers only) · `--d1-local <wrangler state dir>` · `--out <dir>`.

Exit code: **1** LAUNCH BLOCKED (any FAIL) · **2** NOT CLEARED (UNVERIFIED left) · **0** CLEARED.

## Workflow

1. Confirm the mode with the operator. Production on a client's live site sends one marked test
   lead to their real destination: say so before running.
2. Run it. Read `report.md`: the first line is the verdict, FAILs come first with the fix.
3. For each FAIL: report it; fix only when asked, in a separate step; then re-run.
4. For each UNVERIFIED, tell the operator exactly what to do (the report's "To verify" line):
   - **form.e2e on production** is usually UNVERIFIED: Turnstile flags automated browsers by
     design. Submit the marked lead by hand, then `--confirm-lead <that email>` re-checks arrival.
   - **Human checks** (`a11y.keyboard`, `tel.device`, `form.followup`, `gbp`): re-run with
     `--confirm id="what was checked"` once done. Never confirm on the operator's behalf.
5. Hand the report path to the operator. Don't call the site done unless the first line is CLEARED.

## What it checks

Full list with standards, modes and evidence: `references/checks.md`. Report shape:
`references/report-template.md`. Shared page parsing and the SSRF-safe fetch live in
`skills/_shared/site-checks/` (also used by audit-site).

## Open questions (rewrite after 3 real launches)

- Which CRM we standardise on, and how to read a test lead's arrival there without polluting
  client data (today: D1 `sends` proves the webhook answered 2xx; the CRM itself is human).
- Whether call tracking is in scope at L1 or only at L2 (Core).
- Whether Lighthouse needs a median of 3 runs before a FAIL at 85–90 blocks a launch.

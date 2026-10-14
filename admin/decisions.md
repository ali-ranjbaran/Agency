# Decisions

Why we chose what we chose. Newest first. One entry per decision.

## 2026-10-14 · Shared site-checks module for audit-site and qa-site

qa-site was the second build of the same site checks audit-site already had. The common part
moved to `skills/_shared/site-checks/`: the SSRF-safe fetch, the HTML helpers, the vendor
fingerprints, and `parsePage()` page facts plus neutral network checks that return evidence but
no verdict. Each skill keeps its own standard: audit-site grades pass/warn/fail for a sales
audit and maps findings to the offer; qa-site applies the launch gate (PASS/FAIL/UNVERIFIED/N/A,
any FAIL blocks). audit-site's output was diffed before/after the move and is identical.
**Why `_shared` outside the departments:** it isn't a skill and must not be linked as one.
**Revisit if:** a third skill needs it (then consider a package with its own tests and version).

## 2026-10-13 · Operator console at ops.thearkosa.com, sharing the website's D1

`setup/ops-console/`: its own Pages project (`arkosa-ops`) behind Cloudflare Access, with the
Access JWT re-checked on every request. It binds the same D1 `arkosa` as the website.
**Why:** it has to read inbound `leads` and `demo_calls`, and D1 can't join across databases;
one database also keeps personal data in one place. The console never writes the website's tables.
Its migrations start at 1001 so the two migration folders can share `d1_migrations`.
The Mac audit dashboard's planned tunnel moved from ops. to audit.thearkosa.com (it was never live).
**Revisit if:** a client view is added (schema is tenant-ready) or the website's tables change shape.

## 2026-10-13 · Screenshots served through our own signed URL, not R2 presigned URLs

R2 presigned URLs need S3 API keys and SigV4, and only work on the r2.cloudflarestorage.com host.
Instead `/api/snapshots/:id/:view?exp&sig` (HMAC, 5 minutes) streams from the private bucket
through the R2 binding, behind Access. No R2 keys exist anywhere, including on the Mac.
**Revisit if:** screenshots need to be viewed outside the console.

## 2026-10-13 · Google Places: Text Search with a minimal field mask, off until billing exists

`places.id,places.websiteUri` makes each call Text Search Enterprise (1,000 free/month, then
US$35 per 1,000; pricing list of 2026-10-08). A call returns up to 20 places, so a 60-result query
costs 3 calls, about 12 per HVAC search. The hard cap of 500/month stays inside the free tier. Only
`place_id` is stored (Google's terms); the website is used in memory to visit the firm's own site.
**Revisit if:** Google changes SKU pricing or free caps, or OSM + manual turn out to cover the market.

## 2026-10-13 · Prospect lists live in the sending tool, not the repo

**Was:** plan v4's Phase 0 exit check said `admin/prospects` holds the 50 contacts.
**Now:** the list lives in Instantly, with the 4 CASL fields per row. The exit check counts
rows there. `admin/metrics.md` keeps aggregates only.
**Why:** CLAUDE.md keeps personal data out of git. Names and emails in the repo would sit in
its history for good, even after deletion.
**Revisit if:** a second sending tool is added and the list needs one home outside both.

## 2026-10-10 · Internal ops dashboard runs on the Mac, reached through Cloudflare Access

`skills/sales/audit-site/`: paste a website → automated checks against our own delivery
standards → Claude Code headless writes proposals mapped to the offer → optional private mock.
**Where:** a Node server on the Mac mini, bound to 127.0.0.1. Remote use goes through a
Cloudflare Tunnel to `audit.thearkosa.com` (moved from ops. on 2026-10-13; ops. is the operator console), behind an Access login for one email, and the server
re-checks the Access JWT itself. Not a Pages deploy.
**Why:** the write-up uses Claude Code headless (no API key or per-call billing), the same as
the lead runner, and that only runs on the Mac. Audits and mocks live next to the leads in
`~/Arkosa-leads/`, outside the repo. Nothing is publicly reachable.
**Revisit if:** the Mac's uptime becomes a problem, or a second person needs access.

## 2026-10-10 · Client sites on Cloudflare Pages, not Vercel

**Was:** plan v4 locks React/Next.js + Tailwind on Vercel Pro ($20 USD/mo).
**Now:** Next.js static export + Tailwind on Cloudflare Pages.
**Why:** thearkosa.com already runs there with the form, Turnstile, D1 caps and Twilio
webhooks working. Pages is free for commercial use (Vercel Hobby isn't), Turnstile is
built in, and D1 holds the rate limits. The form backend is reused per client instead of
rewritten as a Vercel function plus a separate store.
**Revisit if:** a client needs server rendering or a feature Pages Functions can't do.

## 2026-10-10 · One repo per client site

Client sites live at `~/personal-project/sites/<client>/`, each its own git repo, created by
`templates/site-starter/scripts/new-site.mjs`. `clients/<name>/` keeps context, spec and
`intake.json`.
**Why:** the MSA says the client owns their site and content, so handover at exit is
"here's the repo". It also keeps the Agency repo to the reusable asset: skills and templates.

## 2026-10-10 · A site starter before client #1

The plan says templates come from real builds (after client #2). We built one starter
anyway: `templates/site-starter`, one content file, validated before every build.
**Why:** it removes setup from build #1 (form backend, privacy page, consent, accessibility,
Lighthouse 100 as built) without guessing at copy or section order. Copy still comes from
the intake.
**Rule:** after builds #1 and #2, rewrite the starter from what those builds kept. Until then
it's a starter, not the template.

## 2026-10-10 · Form leads go to the CRM webhook; nothing personal kept on Cloudflare

Client site forms forward to the client's GHL inbound webhook (`CRM_WEBHOOK_URL`). D1 stores
only a salted IP hash and a timestamp for the caps.
**Why:** CLAUDE.md: contacts live in the CRM. One copy of the person's data, in the system
the client already has a data-handling agreement for.

## 2026-10-14 · Documents: git is the source, the console holds review state only

Contracts, templates, run logs and the plan's D1–D10 are reviewed in the ops console
(Documents page), but their text is never edited there. `scripts/collect-docs.mjs` bundles an
allowlist of repo files at build time; D1 stores reviews, comments, the approved text and
decision sign-offs, each tied to the file's sha256. `npm run reviews:pull` brings the
feedback back to the repo.
**Why:** one copy of the text, versioned in git. An approval covers one exact version, so a
later edit can't inherit it. The allowlist and a personal-data scan keep `clients/` and
anything personal out of the console.

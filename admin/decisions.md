# Decisions

Why we chose what we chose. Newest first. One entry per decision.

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
Cloudflare Tunnel to `ops.thearkosa.com`, behind an Access login for one email, and the server
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

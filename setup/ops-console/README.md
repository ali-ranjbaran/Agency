# Arkosa operator console

Internal only, at **ops.thearkosa.com**, for one operator. It replaces the prospect spreadsheet, shows the
inbound website leads and demo-line calls, and holds the lead generator's review queue. It is **not**
the client dashboard (plan v4 §10.5 option C), and nothing in it is client-facing. Nothing sends
from it.

## What's where

| Path | What |
|---|---|
| `functions/_middleware.ts` | Cloudflare Access JWT check on **every** request (static files too). Fails closed (503) without config. Writes must be same-origin JSON. |
| `functions/api/**` | JSON API. `/api/runner/*` accepts only the Mac runner's service token. |
| `migrations/1001_console.sql`, `1002_leadgen.sql` | Console tables in the shared D1 `arkosa`. CASL and suppression gates live **in the schema** (CHECK + triggers). File names start at 1001 so they never collide with the website's migrations. |
| `shared/fit-score.ts` | **The** fit-score config. Edit points and rules here; the UI shows the breakdown on hover. |
| `shared/casl.ts`, `shared/first-line.ts` | CASL field rules; "copy first line" templates (verified signals only). |
| `src/` | React + Tailwind + shadcn/ui. Table, Board, Company, Today, Possible clients, Review queue, Searches, Inbound leads, Ready to send, Import, Suppression. |
| `runner/` | Runs on the Mac: `snapshot.mjs` (screenshots + Lighthouse), `jobs.mjs` (lead searches), `enrich.mjs`, `sources/*` (each opens with its terms note), `install-runner.sh` (launchd). |

Reads, never writes: the website's `leads` and `demo_calls` tables. Demo calls match a company by
hashing its phone with the same `PHONE_HASH_KEY` the demo line uses.

## Rules the code enforces

- **CASL:** a contact is `ready_to_send` only with email + the 4 fields + "I checked the source page".
  Editing a field clears the check. Machine drafts, candidates, refusal statements and anything
  suppressed can't be ready (the database refuses).
- **Suppression** is append-only (no update, no delete). A new row un-readies matching contacts at once.
- **Lead generator:** results are `candidate`s in the review queue. Approve is one company per
  request, and there is no bulk approve. Rejections are remembered. Google Places: only `place_id` is stored,
  with a hard monthly call cap (`PLACES_MONTHLY_CAP`, default 500), one alert email at the cap.
  OSM rows carry "© OpenStreetMap contributors (ODbL)". No directory scraping, ever.
- **Enrichment:** the firm's own site only, robots.txt, `ArkosaLeadResearch/1.0 (+https://thearkosa.com)`,
  1 request / 2 s per domain, ≤ 4 pages, no forms, no logins. Published emails only, never guessed.
- **Screenshots:** private R2 bucket, served only through a 5-minute signed URL behind Access.
  Internal sales research: never published, never reused in a rebuild.
- **Export** is aggregate counts only.

## Tests (all local, fictional data only)

```bash
npm install && (cd runner && npm install && npx playwright install chromium)
npm run typecheck
npm test              # schema gates (CASL, suppression, refusal, Places cap) + Access JWT
npm run test:runner   # snapshots + Lighthouse, enrichment, sources (mocked), on 127.0.0.1 fixtures
npm run test:e2e      # wrangler pages dev + local D1/R2 + mock Access: console flows, lead generator, UI smoke
```

## Setup (one time)

1. **Cloudflare Zero Trust → Access → Applications → Self-hosted** for `ops.thearkosa.com` **and**
   `arkosa-ops.pages.dev`: policy *Allow*, your email only, one-time PIN. Copy the AUD tag.
2. **Service token** `arkosa-runner` (Access → Service auth), plus a second policy on the same app
   with action **Service Auth** including that token. Note the Client ID and Secret.
3. Pages project `arkosa-ops`, custom domain `ops.thearkosa.com`. R2 bucket `arkosa-ops-snapshots`
   (private; no public access, no r2.dev).
4. Secrets: `npx wrangler pages secret put <NAME>` for each name in `.env.example`
   (`PHONE_HASH_KEY` = the website's value).
5. `npm run db:migrate` (adds console tables only; doesn't touch `leads` or the demo tables), then `npm run deploy`.
6. Mac: `cd runner && npm install && npx playwright install chromium && bash install-runner.sh`, then put
   the service token in `~/.arkosa/ops-runner.env`.
7. Check it's closed: a private window on ops.thearkosa.com shows the Access login, and
   `curl -s -o /dev/null -w '%{http_code}' https://arkosa-ops.pages.dev/api/companies` prints 403.

## Later

Not in v1, on purpose:
- Instantly sync (lists are loaded into Instantly by hand from "Ready to send")
- Email sending of any kind
- GHL (CRM) sync
- Anything AI: no AI-written outreach, no AI replies, no AI scoring
- The client-facing view (the schema is tenant-ready: every table has `tenant`)
- Google Places discovery, once a billing account + restricted key exist (`GOOGLE_PLACES_KEY`)
- A thearkosa.com/bot page explaining the two user agents
- Code-splitting the UI bundle (~500 kB; fine for one internal user)

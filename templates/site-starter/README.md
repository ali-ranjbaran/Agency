# Site starter

The base for every L1 client site and every private lead mock. Next.js static export +
Tailwind v4 on Cloudflare Pages, with one Pages Function for the contact form.
A starter, not the final template: refine it after client builds #1 and #2.

`content/site.json` is the only file a build edits. Its shape is `lib/content.ts`.
`npm run build` validates it first (`scripts/validate-content.mjs`), and a client build
fails on any missing required field, placeholder text or failing colour contrast.

## Start a site

```bash
# Client (build-site step 5). Creates ~/personal-project/sites/<name>/ as its own git repo.
node templates/site-starter/scripts/new-site.mjs --client <name> --intake clients/<name>/intake.json

# Private mock from a website lead. Creates <lead folder>/mock/, outside the repo.
node templates/site-starter/scripts/new-site.mjs --mock --lead ~/Arkosa-leads/<folder>/lead.json

# Same, seeded from a site audit (audit-site skill / ops dashboard): its hero, CTA, area and
# services replace the trade preset's where they're well-formed.
node templates/site-starter/scripts/new-site.mjs --mock --lead <folder>/lead.json --seed <folder>/audit/mock-seed.json
```

`intake.json` has the same shape as `content/site.json`, without `mode`. The generator
refuses a client intake without exactly one `conversion.action` (call, form, booking or
quote) and prints the fields still missing.

`content/example.json` is a fictional business ("Northgate Heating & Air") used to test the
template. It shows a "Sample content" banner and is noindex. `npm run deploy` refuses it.

## What the content controls

| Field | Drives |
|---|---|
| `conversion.action` + `label` | The one primary CTA everywhere: hero, header, every page end, final band |
| `hero` | Home headline and subhead |
| `fear` | The "why us" section: fear as eyebrow, answer as heading, proof under it |
| `services[]` | Home cards, one page each at `/services/<slug>/`, the form's service list |
| `proof` | Trust bar (badges, years, licence) and the reviews/stats section; hidden when empty |
| `about.body` | `/about/` and its nav link; nav link hidden when empty |
| `brand` | Five colours, contrast-checked; optional `logo` and `favicon` under `/public` |
| `legal` | Privacy page province, contact and "last updated" |

Mobile always has a "Call" button in the header. The privacy page writes itself from what
the build actually does: form section only when the form is live, analytics section only
when GA4 is set, phone section only when call tracking is set.

## One-time setup per client site

```bash
npm install
npx wrangler login
npx wrangler pages project create <name>-site     # must match `name` in wrangler.toml
npx wrangler d1 create <name>-site-db             # paste database_id into wrangler.toml
npm run db:migrate                                # creates the `sends` table (rate limits only)
# Turnstile: create a managed widget for the client's domain + <name>-site.pages.dev
for s in TURNSTILE_SECRET IP_SALT CRM_WEBHOOK_URL; do npx wrangler pages secret put $s; done
```

Build-time vars, in `.env.local` (the build runs locally; direct upload):

```
NEXT_PUBLIC_SITE_URL=https://<domain>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...
NEXT_PUBLIC_GA4_ID=G-...                     # optional; adds the cookie banner
NEXT_PUBLIC_CALL_TRACKING_NUMBER=+1306...    # optional; replaces the phone everywhere
```

Without a Turnstile key the contact page shows the phone number instead of a form, so the
site never ships a form that can't send.

`CRM_WEBHOOK_URL` is the client's GHL inbound webhook (Automation → Workflow → trigger
"Inbound Webhook"). The form POSTs JSON `{name, phone, email, service, message, source,
page, submitted_at}`. Nothing about the person stays in D1: only a salted IP hash and a
timestamp for the caps (3 per IP per hour, 40 per day, in `wrangler.toml`). If the webhook
fails, the visitor sees the phone number.

Deploy: `npm run deploy`. Then add the custom domain in the Pages dashboard (Custom
domains → Set up → Activate), which also creates the DNS record.

## Mocks

`SITE_MODE = "mock"` in `wrangler.toml`. Every route then needs `MOCK_PASSWORD` (any
username); without it set, the site serves nothing. Mocks are noindex, robots disallow-all,
show a "Concept preview" banner, and the form is disabled at both ends. Never deploy one
publicly, never use the prospect's photography, and blur name and logo in anything posted.
Preview locally:

```bash
npm install && npm run build
npx wrangler pages dev ./out --binding MOCK_PASSWORD=<pick one>
```

## Before calling a site done

`/site-qa-checklist` with no failures. In particular: a real form submission arrives in the
CRM and the follow-up automation fires, Lighthouse performance 90+, analytics and call
tracking verified live, and the client has read the privacy page (it is a starting point,
not legal advice). Replace `/public/favicon.svg` with the client's mark.

## Checks

```bash
npm run validate              # content only
npm run typecheck:functions   # Pages Functions
npm run build
```

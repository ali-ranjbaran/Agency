# Arkosa — landing page

Next.js (App Router) + Tailwind CSS v4. Palette one, light by default.

```
npm install
npm run dev
```

- Tokens: `app/globals.css` (CSS variables + Tailwind `@theme`). Semantic utilities: `bg-bg`, `text-fg`, `text-muted`, `fill-accent`, `bg-band`, etc.
- Dark version: set `data-theme="dark"` on `<html>` in `app/layout.tsx`.
- Scroll animation: `components/ScrollReveal.tsx` + the "Scroll reveal" block in `globals.css`. Add `data-reveal` (and optionally `style={{"--d":"120ms"}}`) to any element. Disabled automatically for reduced-motion users.
- Logos: `public/logo/` (light, dark, one-color, square marks). Favicon: `public/favicon.svg`.
- Wordmark is outlined Hanken Grotesk SemiBold; no font dependency in the logo files.

## Build and deploy

- `npm run deploy` = `next build` (static site to `out/`) + `wrangler pages deploy` (uploads `out/` **and** `functions/`).
  Uploading `out/` by itself through the dashboard drops the functions, so the form and demo line stop working.
- `lib/site.ts` holds the domain, email, nav, and the build-time switches for the four start options.
- `app/privacy/page.tsx` is the privacy page; it covers the form and the demo line. Update it before adding analytics.

## Get-started options and backend

The landing page's **Get started** section (`#start`) shows up to four options. Each one appears only when its config exists.

| Option | Shown when | What happens |
|---|---|---|
| Call the demo line | `NEXT_PUBLIC_DEMO_NUMBER` set | `functions/api/twilio/voice.ts` rejects the call (busy, not billed) and texts back as "Northgate Heating". `sms.ts` sends one canned reply per text-back, then nothing, and records STOP/START. Every call is logged to D1 `demo_calls` (hashed number + last 4). Logic: `server/demo-line.ts`. |
| Missed-call calculator | always | Runs in the browser. "Send me these numbers" copies them into the form. |
| Book 20 minutes | `NEXT_PUBLIC_BOOKING_URL` set | Opens the booking page. |
| Send your details | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set (else an email option) | `functions/api/intake.ts` → D1 `leads` → the Mac runner (`skills/sales/prep-discovery`) writes a brief + draft reply to `~/Arkosa-leads/`. Nothing is sent without you. |

Caps (in `wrangler.toml` `[vars]`): 3 form sends per IP per hour, 40 per day. Demo line: 1 text per caller per 10 min, 50 texts per day, 300 per month (replies count), each checked and reserved in one SQL statement. Hitting the day or month cap emails the operator once per period through the `arkosa-alerts` Worker (`../arkosa-alerts`). No model call happens on any public endpoint.

### One-time setup

```bash
npm install
npx wrangler login
npx wrangler d1 create arkosa                 # paste the database_id into wrangler.toml
npm run db:migrate                            # creates leads, demo_calls, demo_opt_outs, demo_alerts
# Turnstile: Cloudflare dashboard → Turnstile → add widget for thearkosa.com (managed)
for s in TURNSTILE_SECRET IP_SALT TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_DEMO_NUMBER PHONE_HASH_KEY; do
  npx wrangler pages secret put $s
done
# Cap alerts: Email Routing on thearkosa.com with your address verified as a destination, then
npx wrangler secret put ALERT_TO -c ../arkosa-alerts/wrangler.toml
npx wrangler deploy -c ../arkosa-alerts/wrangler.toml   # before the site, so the ALERTS binding resolves
```

Names of every variable and secret: `.env.example`. Local values go in `.dev.vars` (gitignored).

Build-time vars (Pages → Settings → Variables, and `.env.local` for `npm run dev`):
`NEXT_PUBLIC_DEMO_NUMBER=+1306...`, `NEXT_PUBLIC_BOOKING_URL=https://...`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...`

Twilio console → the demo number → Voice "A call comes in": `https://thearkosa.com/api/twilio/voice` (POST);
Messaging "A message comes in": `https://thearkosa.com/api/twilio/sms` (POST). Set Geo Permissions to Canada + US only.

Checks: `npm run typecheck:functions` and `npm run test:demo-line` (signature unit tests, then the
whole demo line end to end on this machine: mock Twilio, local D1, simulated alert email). Then 3 live
test calls from 2 carriers (plan Phase 0 exit), logged in `admin/demo-line-test.md`.

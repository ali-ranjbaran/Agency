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
| Call the demo line | `NEXT_PUBLIC_DEMO_NUMBER` set | `functions/api/twilio/voice.ts` rejects the call (busy, not billed) and texts back once. `sms.ts` handles STOP/START and one fixed reply. |
| Missed-call calculator | always | Runs in the browser. "Send me these numbers" copies them into the form. |
| Book 20 minutes | `NEXT_PUBLIC_BOOKING_URL` set | Opens the booking page. |
| Send your details | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set (else an email option) | `functions/api/intake.ts` → D1 `leads` → the Mac runner (`skills/sales/prep-discovery`) writes a brief + draft reply to `~/Arkosa-leads/`. Nothing is sent without you. |

Caps (in `wrangler.toml` `[vars]`): 3 form sends per IP per hour, 40 per day, 30 demo texts per day, 1 text per number per 24 h. No model call happens on any public endpoint.

### One-time setup

```bash
npm install
npx wrangler login
npx wrangler d1 create arkosa                 # paste the database_id into wrangler.toml
npm run db:migrate                            # creates leads, demo_sms, opt_outs
# Turnstile: Cloudflare dashboard → Turnstile → add widget for thearkosa.com (managed)
for s in TURNSTILE_SECRET IP_SALT TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_DEMO_NUMBER; do
  npx wrangler pages secret put $s
done
```

Build-time vars (Pages → Settings → Variables, and `.env.local` for `npm run dev`):
`NEXT_PUBLIC_DEMO_NUMBER=+1306...`, `NEXT_PUBLIC_BOOKING_URL=https://...`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...`

Twilio console → the demo number → Voice "A call comes in": `https://thearkosa.com/api/twilio/voice` (POST);
Messaging "A message comes in": `https://thearkosa.com/api/twilio/sms` (POST). Set Geo Permissions to Canada + US only.

Checks: `npm run typecheck:functions`, then 3 test calls from 2 carriers (plan Phase 0 exit).

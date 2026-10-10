# Audit checklist

What `scripts/checks.mjs` checks, the standard each one is held to, and where
each finding leads in the offer. The standards are ours: CLAUDE.md delivery
standards and `build-site/references/conversion-patterns.md`. A prospect's
site is held to the same bar as a site we ship.

Statuses: **pass**, **warn**, **fail**, **info** (a signal, not a defect),
**unverified** (the script couldn't tell; say so, never upgrade it to pass).

## Conversion

| id | Standard | Offer |
|---|---|---|
| `tel-link` | A working `tel:` link exists | L1 |
| `phone-above-fold` | Phone number visible in the first mobile screen. Script guesses from text position; confirm with the screenshot | L1 |
| `cta-above-fold` | One primary action (call, quote, book) in the first screen, as a real button | L1 |
| `competing-ctas` | One primary action. 3+ equal channels (phone, form, booking, chat) is a warn | L1 |
| `form-fields` | Primary form has ≤5 visible fields. Form inside an iframe → unverified | L1 |
| `cta-copy` | No "Submit", "Learn more", "Click here" as button text | L1 |
| `carousel-hero` | No slider/carousel library on the homepage | L1 |
| `autoplay-sound` | No autoplay video with sound | L1 |

## Trust

| id | Standard | Offer |
|---|---|---|
| `reviews-on-site` | Real reviews or testimonials on the homepage | L1 + Core: review requests |
| `license-insured` | Licence, insurance or certification named | L1 |
| `years-in-business` | A real number of years or a founding year | L1 |
| `filler-copy` | None of the filler phrases from `copy-formulas.md` | L1 (copy) |
| `copyright-stale` | Footer year is current or last year | info, conversation opener only |

## Speed (PageSpeed Insights, mobile; *measured*)

| id | Standard | Offer |
|---|---|---|
| `psi-performance` | 90+ pass · 50–89 warn · under 50 fail | L1 |
| `lcp` | ≤2.5 s pass · ≤4 s warn · over 4 s fail | L1 |
| `cls` | ≤0.1 pass · ≤0.25 warn · above fail | L1 |
| `image-formats` | WebP/AVIF in use when the page has photos | L1 |
| `lazy-images` | Below-the-fold images lazy-loaded (more than 4 images, none lazy → warn) | L1 |

## Accessibility (WCAG 2.1 AA is our floor)

| id | Standard | Offer |
|---|---|---|
| `psi-accessibility` | 90+ pass; failing Lighthouse audits listed in evidence | L1 |
| `html-lang` | `<html lang>` set | L1 |
| `img-alt` | Every `<img>` has an `alt` attribute | L1 |
| `form-labels` | Every visible form field has a label or aria-label | L1 |

## Local SEO

| id | Standard | Offer |
|---|---|---|
| `https` | Final URL is https, and http redirects to it | L1 |
| `viewport` | Mobile viewport meta present | L1 |
| `title-tag` | Present; names the service or the city | Local SEO |
| `meta-description` | Present | Local SEO |
| `h1` | Exactly one | L1 |
| `city-mentioned` | A prairie city or town appears on the homepage | Local SEO |
| `localbusiness-schema` | LocalBusiness-type JSON-LD (HVACBusiness, Plumber, Electrician…) | Local SEO |
| `sitemap` / `robots` | Both respond 200 | Local SEO |
| `psi-seo` | 90+ pass | Local SEO |

## Compliance

| id | Standard | Offer |
|---|---|---|
| `privacy-policy` | A privacy policy is linked | L1 |
| `cookie-consent` | Analytics or ad pixels present → a consent tool must be too | L1 |
| `analytics` | Some analytics present (otherwise nothing can be measured, including our day-25 report) | L1 / Core |
| `call-tracking` | info: call tracking in use or not | Core |

## Never miss it (signals for the Core pitch, all info)

| id | Signal | Leads to |
|---|---|---|
| `after-hours` | "24/7", "emergency", "after hours" claimed | Missed-call text-back. Ask: who picks up at 2 am? |
| `fsm-software` | Jobber, Housecall Pro or ServiceTitan detected | Objection prep (plan §3.5): "Keep it. This covers calls that never become a job in Jobber." |
| `crm-detected` | GoHighLevel/LeadConnector or HubSpot already on the site | They may already pay for a CRM; ask what's switched on |
| `online-booking` | Booking widget present or absent | Quote follow-up |
| `quote-form` | Quote/estimate request form present | Quote follow-up (Core) |
| `review-widget` | Review widget present or absent | Review requests (Core) |
| `site-builder` | Wix, Squarespace, GoDaddy, WordPress, etc. | Rebuild pitch; "my nephew does my website" objection |

## Ranking (for the top 3 in audit.md)

Pick the first three that fail, in this order. Warns count only when there
aren't three fails.

1. No `tel:` link, or no phone in the first mobile screen
2. No single clear action in the first screen, or competing CTAs
3. Mobile LCP over 4 s or performance under 50
4. Primary form over 5 fields, or no way to send a request at all
5. No reviews or proof on the homepage
6. Carousel hero or autoplay sound
7. Headline and title don't name the service or the city
8. Accessibility failures (contrast, alt text, labels)

Compliance failures (privacy, cookie consent) are always listed in their own
line under the top 3, whatever their rank. They are legal exposure for the
owner, not conversion, and they're an easy, credible opener.

## Offer mapping

- **The site is the main leak** (2+ of ranking items 1–4 fail) → lead with
  L1, the site rebuild, and mention Core as what runs underneath.
- **The site is fine but calls leak** (ranking 1–4 mostly pass; after-hours
  claim, no text-back, no review flow) → lead with Core (missed-call
  text-back first), and say the site doesn't need replacing. Plan v4: "I'm not
  replacing it; this runs underneath your phone number."
- **Thin reviews** (found count under the top competitor's) → review requests
  inside Core.
- **Local SEO failures only** → mention `setup-local-seo`; don't lead with it.
- Add-ons are never pitched from an audit. They're pitched at the month-3
  review (plan v4 §8.4).

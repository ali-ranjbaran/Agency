---
name: build-site
description: >
  Build a conversion-focused marketing website for a client from a brief.
  Use whenever the operator says build the site, build a site for [client],
  new client site, start the build, here's the intake go, or names a signed
  client and asks for their site to be built — even without the word
  "website" (e.g. "kick off the HVAC company's build", "let's get their site
  going"). This is the primary delivery skill for Level 1/2 marketing sites
  and should trigger any time construction work for a specific client's
  public-facing site is implied, not only when explicitly requested.
---

# Build Site

**Trigger examples:** "build the site for [client]" · "we closed [client],
start the build" · "new L1 job, here's the intake" · "here's the intake,
go" · "kick off [client]'s build"

Takes a client brief through interview → build plan → build → copy →
accessibility pass → handoff. Produces a production, conversion-focused
marketing site. Does not deploy and does not QA itself — that is `qa-site`'s
job, and this skill must stop before it.

## 0 · Gate: don't start without these

Refuse to move past the interview until you have, at minimum: the client
name, the one primary conversion action, and either an onboarding
survey/intake doc or direct answers to the interview below. If `onboard-client`
has already run for this client, read its output first instead of
re-asking questions it already captured.

## 1 · Interview

Ask, don't assume. If any of these came from an intake doc, confirm rather
than skip:

- Industry and specific services offered
- Service area (city/region, not just "local")
- **The primary conversion action — exactly one.** Call, form, booking, or
  quote request.
- Brand vibe (3 adjectives) and any existing assets (logo, colors, photos
  with usage rights confirmed)
- 2–3 competitors, and what the client thinks those competitors do better
- Tone (e.g. blue-collar direct vs. polished professional)
- Must-have pages beyond home (services, service-area, about, reviews,
  contact)
- **What is their customer actually afraid of?** Being overcharged, a bad
  job that has to be redone, someone unlicensed, being ghosted after
  booking. This answer drives more of the copy than the other nine
  combined — don't let it get a throwaway answer.

Full question set with follow-up prompts: `references/intake-questions.md`.

Save the answers to `clients/<name>/intake.json`, in the shape of the
template's `content/site.json` (`templates/site-starter/lib/content.ts`),
without `mode`. Business facts only: no customer data, no personal contact
lists.

## 2 · Gate: name the one conversion action

**Do not proceed to the build plan until a single primary conversion action
is named.** Every layout, every above-the-fold decision, every CTA
derives from it. A site with three co-equal CTAs (call, form, and chat,
all pushed equally) converts worse than a site with one clear ask — say
this to the client or operator if they resist naming just one.

## 3 · Decide the stack — state it, don't assume it

Pick using the rule in `references/stack-decision.md` and write the choice
plus the reasoning into the project's `build-plan.md` before writing any
code:

- **Brochure site, under ~10 pages, no auth, client won't edit copy
  themselves** → `templates/site-starter`: Next.js static export +
  Tailwind on Cloudflare Pages. Lighthouse 95+ is the point; the starter
  scores 100 as built.
- **Client must edit their own copy** → static + headless CMS, or
  Next.js + CMS.
- **Auth, dashboards, dynamic data, or a Level 3 upgrade path** →
  Next.js + Tailwind + shadcn/ui.

If no rule clearly applies, ask rather than guess.

## 4 · Gate: build plan before code

Produce `build-plan.md`: full page list, section-by-section structure per
page, the stack choice with reasoning. **Get explicit approval before
writing any code.**

## 5 · Build

For branch 1, start from the template:

```bash
node templates/site-starter/scripts/new-site.mjs --client <name> --intake clients/<name>/intake.json
```

It creates `~/personal-project/sites/<name>/` as the client's own git repo
(the client owns their site at exit), refuses without exactly one
conversion action, and lists what's still missing. The build itself is
filling `content/site.json` until `npm run validate` passes, then adapting
sections the intake calls for. Setup steps are in the template's README.

Real content structure from the interview answers — no lorem ipsum, no
placeholder headings. A placeholder heading survives to launch more often
than it should; don't create the temptation. The validator fails the build
on placeholder text, so this is enforced, not just advised.

Non-negotiable conversion elements — build these in, don't treat them as
optional polish:

- CTA above the fold, with a working `tel:` click-to-call on mobile
- One social proof section (reviews, project photos, years in business,
  license/insurance badges — whatever the intake surfaced)
- Contact form wired to a real, tested destination. Default: the client's
  GHL inbound webhook as the `CRM_WEBHOOK_URL` secret (the template's
  `functions/api/lead.ts` forwards to it). Confirm with the operator if the
  client's CRM isn't GHL.
- Fast load: compressed images, lazy-loaded below the fold, minimal JS
- Motion in code (CSS transitions/small JS), not a heavy animation library

See `references/conversion-patterns.md` for section-by-section detail and
patterns to avoid.

## 6 · Copy pass

Headlines and service descriptions written for *this* client's customer,
using the intake answers and any sales-call language available — never
generic industry filler ("Your trusted local experts since day one" is
filler; a specific claim tied to something the client actually said is
not). Lead copy with the fear identified in step 1 where it fits naturally.

Formulas and before/after examples: `references/copy-formulas.md`.

## 7 · Accessibility — a build constraint, not a later fix

WCAG 2.1 AA as you go: semantic landmarks (`<nav>`, `<main>`, `<footer>`),
full keyboard navigation, contrast ratios checked against the actual brand
palette (not assumed), alt text written with real content, not filenames.
Retrofitting this after the build costs several times what building it in
costs — don't defer it.

## 8 · Handoff — and stop

Hand off to `qa-site` with a note naming what to check first (anything you
were unsure about, any form destination that isn't fully tested yet, any
image you used without a confirmed usage right). **This skill does not
deploy.** Stop here.

## Hard rules

- Never use a client's or prospect's own photography without written
  permission on file. Use licensed stock or generated imagery instead
  and flag the gap.
- No secrets in code, ever. Env vars only, documented in `.env.example`.
- Every form must point at a real, tested destination before the site is
  called done — "the form renders" is not the same as "the form works."
  Full end-to-end verification is `qa-site`'s job, but this skill does not
  hand off a form with a fake or placeholder endpoint.

## Outputs

- `build-plan.md` — page list, structure, stack decision + reasoning
- Site source, matching the chosen stack
- `.env.example` — variable names only, no values
- A handoff note for `qa-site`: what to check first, what's unverified

## References

- `references/stack-decision.md` — the full decision rule, with the
  React-vs-static-site-generator tradeoff spelled out
- `references/conversion-patterns.md` — section-by-section build patterns
- `references/copy-formulas.md` — headline and service-description formulas
- `references/intake-questions.md` — the full interview with follow-ups

## Open questions (rewrite after build #2)

- Section ordering that actually converts for this niche vs. others —
  right now the order in `conversion-patterns.md` is a reasonable starting
  guess, not a tested pattern.
- How much copy the client will realistically write themselves vs. how
  much this skill should draft in full.
- Whether a headless CMS is worth the added complexity below a certain
  ticket size, or whether "client wants to edit copy" should just mean
  "operator edits it for them for the first year."
- Whether the GHL inbound-webhook default holds up on client #1: field
  mapping, and whether the follow-up automation fires reliably from it.
- Which parts of `templates/site-starter` survive builds #1 and #2
  unchanged. Rewrite the template from what the real builds kept.

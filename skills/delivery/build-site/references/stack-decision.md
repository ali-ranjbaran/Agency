# Stack decision rule

State the choice and the reasoning in the project's `build-plan.md` before
writing any code. Don't silently default — say which branch applied and why.

## The three branches

### 1. Brochure site, under ~10 pages, no auth, client won't edit copy themselves

**Default: `templates/site-starter`. Next.js static export + Tailwind v4 on
Cloudflare Pages, with one Pages Function for the contact form.**

Start it with `new-site.mjs --client` (see `SKILL.md` step 5). Why this and not
a pure static-site generator (Astro, 11ty):

- It's the same toolchain as thearkosa.com, so the form backend (Turnstile,
  caps, CRM forward) is already proven, not rebuilt per client.
- Static export ships plain HTML. The starter scores Lighthouse 100 on
  performance as built; the JS cost of React doesn't threaten the 90+ floor.
- A Level 3 upgrade later (dashboard, client portal) is additive: drop
  `output: "export"` and the same codebase grows a server.

Use something else only when the client brings an existing site or platform
that has to be kept. Say so in `build-plan.md`.

Hosting is Cloudflare Pages, not Vercel: free for commercial use, Turnstile
built in, and D1 for the form caps. See `admin/decisions.md`.

### 2. Client must edit their own copy

**Static + headless CMS, or Next.js + CMS.**

- Static + CMS (e.g. a git-based or API-first CMS feeding a static
  build) when edits are infrequent and a rebuild-on-publish delay of a
  few minutes is fine.
- Next.js + CMS when the client expects to see edits reflected
  immediately, or when the CMS needs to gate content by role.

Most trades clients in the L1/L2 tier do not actually need this — confirm
it's a real requirement (not just "it'd be nice") before taking on the
added complexity, since it's the single biggest driver of scope creep in
a brochure build.

### 3. Auth, dashboards, dynamic data, or a Level 3 upgrade path

**Next.js + Tailwind + shadcn/ui.**

No branching within this tier at v0 — auth pattern, database choice, and
hosting split (Pages static front + wherever the backend lives) are project-
specific decisions to make during the interview, not something this
reference should pre-decide.

## What NOT to do

- Don't reach for a headless CMS "just in case" — it's the single biggest
  source of scope creep on a brochure build.
- Don't run Next.js as a server for a brochure site. Branch 1 is a static
  export; a server buys nothing without auth, dynamic data or an L3 path.
- Don't let the client's vague future ambition ("we might want a customer
  portal someday") force a Level 3 stack on a Level 1 job. Build for what's
  contracted; note the upgrade path in `build-plan.md` instead.

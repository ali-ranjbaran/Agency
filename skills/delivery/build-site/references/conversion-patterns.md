# Conversion patterns

Section-by-section guidance for the homepage and service pages. Treat the
ordering below as a starting default, not a fixed rule — see "Open
questions" in `SKILL.md` for why.

## Homepage structure (default order)

1. **Hero** — headline naming the service + service area, the primary
   conversion action as a real button (not a link styled like one),
   `tel:` click-to-call visible without scrolling on mobile.
2. **Trust bar** — license/insurance/certification badges, years in
   business, or a one-line stat (jobs completed, average response time).
   Keep this thin — logos and numbers, not paragraphs.
3. **Services overview** — 3–6 service cards, each linking to its own
   page if the site has service pages. Icon + 1-sentence description, not
   a paragraph.
4. **Social proof** — reviews (real, sourced, with attribution) or
   before/after project photos. This is the section most likely to get
   skipped under time pressure; don't skip it.
5. **Why us / the fear answer** — this is where the "what's their
   customer afraid of" answer from the interview earns its place. Frame
   as reassurance, not a sales pitch: "Licensed, insured, and we show up
   when we say we will" beats "We're the best in the business."
6. **Service area** — a simple list or map, not a full page unless the
   client covers many distinct municipalities.
7. **Final CTA** — restate the primary conversion action. Don't introduce
   a second competing action here.
8. **Footer** — contact info, service area, license number if applicable,
   links to legal pages.

## Things that hurt conversion — avoid these even if the client asks for them

- **Multiple competing CTAs above the fold** (call *and* form *and* chat
  widget, all equally weighted). Push back; if the client insists, make
  one visually primary and the others secondary.
- **A carousel/slider as the hero.** Nobody waits for slide two. Pick the
  single strongest image or message.
- **Autoplay video with sound.** Muted autoplay background video is fine;
  sound is not.
- **A contact form with more than 4–5 fields** for the primary conversion
  action. Name, phone, service needed, and a short message is usually
  enough — every extra field costs completions.
- **Stock photography that obviously doesn't match the trade or region**
  (generic "handshake" photos, obviously non-local architecture in the
  background). Prefer trade-specific, regionally plausible stock over
  generic corporate stock.

## Forms

- The primary form's destination must be tested with a real submission
  before handoff, not just visually verified. `qa-site` re-verifies this
  end-to-end (including CRM/automation trigger), but this skill should
  not hand off a form pointing at a fake or placeholder endpoint.
- Default destination: the client's GHL inbound webhook (`CRM_WEBHOOK_URL`
  in the template). Confirm with the operator during the interview if the
  client uses a different CRM, and confirm the webhook exists before
  handoff.
- Show a real success state (message or redirect), not just a spinner
  that stops.

## Performance defaults

- Serve images in a modern format (WebP/AVIF) with explicit width/height
  to avoid layout shift.
- Lazy-load everything below the first viewport.
- Subset fonts to the character set actually used; avoid loading more
  than 2 font weights per family.
- No animation library for simple entrance effects — CSS transitions or
  a handful of lines of JS cover 95% of what a brochure site needs.

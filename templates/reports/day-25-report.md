---
title: Day-25 report
kind: report
version: 0.1
status: draft
---

# {Company} · first 25 days

> **DRAFT v0, Illia rewrites by hand before use.** Plan v4 §3.4. One page. Every line has a
> label. Never claim a number that wasn't measured. If recovered revenue is under the
> retainer, say so and propose the fix.

Period: {START_DATE} to {END_DATE}

| Line | Number | Source | Label |
|---|---|---|---|
| Inbound calls | {INBOUND_CALLS} | Call log (Twilio / GHL) | measured |
| Spam or robocalls, left out of everything below | {SPAM_CALLS} | Call log + spam tags | measured |
| Missed calls (spam excluded) | {MISSED_CALLS} | Call log | measured |
| Missed calls that got a text | {TEXTED} | Workflow stats | measured |
| Median time to text | {MEDIAN_SECONDS} s | Workflow timestamps | measured |
| Callers who replied | {REPLIED} | Message log | measured |
| Jobs booked from those replies | {BOOKED} | You told us on {CONFIRM_DATE} | client-confirmed |
| Value of those jobs | {BOOKED} × {AVG_JOB_VALUE} = {RECOVERED_VALUE} | Your average job value | estimated |
| Review requests sent | {REVIEW_REQUESTS} | Workflow stats | measured |
| New Google reviews | {NEW_REVIEWS} | Google Business Profile | measured |
| Rating | {RATING_BEFORE} → {RATING_AFTER} | Google Business Profile | measured |

## What this means

{ONE_PARAGRAPH: plain reading of the numbers. If {RECOVERED_VALUE} is below the retainer,
say it here and name the fix.}

## Day 31

- **If you continue:** the automations keep running, unchanged. The retainer starts on
  {DAY_31_DATE}. You get this report monthly.
- **If you don't:** the automations switch off on {DAY_31_DATE}. You keep the website. We
  send you a CSV of the contacts and messages from these 25 days, then delete our copy.

## Two names?

If this was useful, who are two other trades owners who'd want to see it?

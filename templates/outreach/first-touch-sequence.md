---
title: First-touch email sequence
kind: outreach
version: 0.1
status: draft
---

# First-touch email sequence

> **DRAFT v0, Illia rewrites by hand before use.** Plan v4 §2.3. Three emails, each under
> 90 words in the body (footer excluded). Send only to rows that pass the §2.5 A checklist.

Merge fields: `{Company}` · `{FirstName}` (only if the published address names them,
else "Hi there") · `{FACT_ABOUT_THEM}` one verifiable fact with its source in the row ·
`{COMPETITOR_FACT}` · `{DEMO_NUMBER}` · `{MAILING_ADDRESS}` · `{UNSUBSCRIBE_LINK}`.

## Email 1 · day 0

**Subject:** `missed calls at {Company}`

> Hi {FirstName},
>
> {FACT_ABOUT_THEM}
>
> In January, a furnace call that hits voicemail usually calls the next company on the
> list.
>
> Call {DEMO_NUMBER} and hang up. You'll get a text back in about 10 seconds. That's what
> your customers would get, from your number, with your name.
>
> Worth 10 minutes this week?
>
> Illia

Body: 51 words counting `{FACT_ABOUT_THEM}` as one; a 15–25 word fact keeps it at 66–76.

## Email 2 · day 4

**Subject:** `re: missed calls at {Company}`

> Hi {FirstName},
>
> One number: {COMPETITOR_FACT}
>
> Most of that gap is follow-up. A review request goes out after every job, and a missed
> call gets a text before the caller tries someone else.
>
> The demo is still live: {DEMO_NUMBER}. Let it ring, hang up, watch the text.
>
> Worth a look?
>
> Illia

Body: 50 words counting `{COMPETITOR_FACT}` as one; stays under 90 with a fact up to 39 words. Example fact: "You have 41 Google reviews; the
top HVAC result in Saskatoon has 380." Only use numbers you checked that day.

## Email 3 · day 9

**Subject:** `re: missed calls at {Company}`

> Hi {FirstName},
>
> Last note from me. If a call isn't convenient, want me to send a 60-second video showing
> what a missed call at {Company} would look like with the text-back on?
>
> Reply "video" and I'll send it.
>
> Illia

Body: 39 words.

## Footer (every email)

```
Illia · Arkosa · thearkosa.com
{MAILING_ADDRESS}
You're getting this because your business email is published on {SOURCE_SITE}.
Not interested? {UNSUBSCRIBE_LINK} or reply "stop" and you won't hear from me again.
```

## Sending rules

- ≤10 per inbox per day while warming. Stop the sequence at any reply.
- Check the suppression list before every send. Never delete it.
- No SMS to prospects, ever.

## §2.5 A checklist result

| Check | Email 1 | Email 2 | Email 3 |
|---|---|---|---|
| Under 90 words (body) | Yes, 51 + fact | Yes, 50 + fact | Yes, 39 |
| Identifies the sender (name, business) | Yes, footer | Yes, footer | Yes, footer |
| Mailing address + web contact | Yes, `{MAILING_ADDRESS}` + thearkosa.com | Yes | Yes |
| Unsubscribe that works 60 days, honoured in 10 business days | Link in footer; Instantly must honour it — **verify setting** | Same | Same |
| Relevance to their role | Yes, about their call handling | Yes, reviews/follow-up | Yes |
| Source URL, capture date, no-refusal check, relevance rationale on the row | Not in the template; enforced per row in Instantly / the console. **Illia checks** | Same | Same |
| No cold SMS | Yes | Yes | Yes |
| Voice: no hype, no exclamation marks, no "AI-powered" | Yes | Yes | Yes |
| Price quoted | No | No | No |

Open: the footer's "reply stop" needs a person or rule in Instantly that adds the address
to the suppression list.

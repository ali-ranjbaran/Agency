---
title: CASL wording for client-side messages
kind: wording
version: 0.1
status: draft
---

# CASL wording for client-side messages

> Fixed wording for messages sent on a client's behalf. Draft, not legal advice. Must be
> reviewed once before client #1 goes live. Source links sit beside each consent rule;
> re-check them before review. [LAWYER]

Placeholders: `{CLIENT_NAME}` trading name · `{CLIENT_PHONE}` · `{CLIENT_WEB}` website ·
`{CLIENT_MAILING_ADDRESS}` · `{CUSTOMER_FIRST_NAME}` · `{REVIEW_LINK}` · `{QUOTE_LINK}`.

## Rules that apply to every message

- **Sender ID.** The message names the business it is sent for. A message sent on the
  client's behalf identifies the client. [LAWYER]
<!-- source: https://laws-lois.justice.gc.ca/eng/regulations/SOR-2012-36/FullText.html s.2; https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.11(2); checked 2026-10-14 -->
- **Contact details.** Each message, or a link in it, gives a mailing address plus a
  phone number, email or web address that works for at least 60 days after sending.
<!-- source: https://laws-lois.justice.gc.ca/eng/regulations/SOR-2012-36/FullText.html s.2; https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.11(2); checked 2026-10-14 -->
- **Unsubscribe.** Each commercial message carries a free, easy unsubscribe. In SMS that is
  "Reply STOP to opt out". A STOP is honoured immediately by the workflow, and in all cases
  within 10 business days. [LAWYER]
<!-- source: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.11; https://laws-lois.justice.gc.ca/eng/regulations/SOR-2012-36/FullText.html s.3; https://web.archive.org/web/20261010210139/https://crtc.gc.ca/eng/com500/faq500.htm (CRTC FAQ via Wayback; crtc.gc.ca returned 403 directly); https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/texting-good-client-relations; checked 2026-10-14 -->
- **Records.** The workflow stores, per contact: consent basis, the date it started, the
  date it expires, and the date of any STOP. The sender has to be able to prove consent.
<!-- source: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.13; https://web.archive.org/web/20261010210139/https://crtc.gc.ca/eng/com500/faq500.htm (CRTC FAQ via Wayback; crtc.gc.ca returned 403 directly); checked 2026-10-14 -->
- **Never** send to a contact whose consent has expired or who has replied STOP. Never cold
  SMS.

Contact-details line used where SMS length forces a link:
`{CLIENT_NAME}, {CLIENT_PHONE}, {CLIENT_WEB}` — the web page lists the mailing address.
[LAWYER]

## 1 · Missed-call text-back

- **Consent basis:** implied, from the caller's inquiry (they called the business).
  Arguably also a reply to an inquiry, which is excluded from the consent rules; no official
  guidance names missed-call text-backs, so the text keeps the business name and STOP anyway.
  [LAWYER]
<!-- source: https://laws-lois.justice.gc.ca/eng/regulations/SOR-2013-221/FullText.html s.3(b); unverified for text-backs specifically -->
- **Expiry:** 6 months from the call.
<!-- source: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.10(9)-(10); https://web.archive.org/web/20261010210139/https://crtc.gc.ca/eng/com500/faq500.htm (CRTC FAQ via Wayback; crtc.gc.ca returned 403 directly); checked 2026-10-14 -->
- **Sends when:** an inbound call is not answered. Never to a number tagged as spam.
  One text per call, at most one per number per {TEXTBACK_COOLDOWN_HOURS} hours.

Wording (under 160 characters where possible):

> Hi, this is {CLIENT_NAME}. Sorry we missed your call. What can we help with? Reply here
> or call {CLIENT_PHONE}. Reply STOP to opt out.

## 2 · Review request

- **Consent basis:** implied, from a purchase (a completed job). No CRTC guidance found on
  review requests; treated as a commercial message to be safe. Never add an offer to it.
  [LAWYER]
- **Expiry:** 2 years from the job date.
<!-- source: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.10(9)-(10); https://web.archive.org/web/20261010210139/https://crtc.gc.ca/eng/com500/faq500.htm (CRTC FAQ via Wayback; crtc.gc.ca returned 403 directly); checked 2026-10-14 -->
- **Sends when:** the client marks the job complete. One request, at most one reminder 3
  days later. Stops at STOP or once a review is detected.

> Hi {CUSTOMER_FIRST_NAME}, thanks for choosing {CLIENT_NAME}. If you have a minute, a
> Google review helps us a lot: {REVIEW_LINK}. Reply STOP to opt out.

Reminder:

> Hi {CUSTOMER_FIRST_NAME}, {CLIENT_NAME} here, one last note about a review:
> {REVIEW_LINK}. No more messages about this. Reply STOP to opt out.

## 3 · Past-customer reactivation (tune-up)

- **Consent basis:** implied, from a purchase **within the last 2 years only**, or express
  consent on record. [LAWYER]
- **Expiry:** 2 years from the most recent job. Express consent lasts until withdrawn.
<!-- source: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.10(9)-(10); https://web.archive.org/web/20261010210139/https://crtc.gc.ca/eng/com500/faq500.htm (CRTC FAQ via Wayback; crtc.gc.ca returned 403 directly); checked 2026-10-14 -->
<!-- source: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.10(1); https://laws-lois.justice.gc.ca/eng/regulations/SOR-2012-36/FullText.html s.4; https://web.archive.org/web/20250513204205/https://crtc.gc.ca/eng/com500/guide.htm (CRTC implied-consent guidance via Wayback); checked 2026-10-14 -->
- **Hard gate:** the import drops any contact with no last-job date, or a last job older
  than 2 years, unless express consent is recorded with its date and wording.
- **Sends when:** a scheduled campaign (seasonal, or a cold-snap forecast). At most
  {REACTIVATION_PER_SEASON} per season.
- **After 2 years:** don't text or email to ask for consent. A consent request sent by email
  or SMS is itself a commercial message. Ask by phone or in person, and record the date and
  wording. [LAWYER]
<!-- source: https://web.archive.org/web/20250513204205/https://crtc.gc.ca/eng/com500/guide.htm (CRTC implied-consent guidance via Wayback) -->

> Hi {CUSTOMER_FIRST_NAME}, it's {CLIENT_NAME}. We serviced your system last year. Want
> your furnace checked before the cold? Reply YES and we'll call to book. Reply STOP to opt
> out. {CLIENT_WEB}

## 4 · Quote follow-up

- **Consent basis:** implied, from the inquiry that led to the quote. A message that only
  delivers the quote the customer asked for may fall under narrower rules. [LAWYER]
- **Expiry:** 6 months from the inquiry.
<!-- source: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.10(9)-(10); https://web.archive.org/web/20261010210139/https://crtc.gc.ca/eng/com500/faq500.htm (CRTC FAQ via Wayback; crtc.gc.ca returned 403 directly); checked 2026-10-14 -->
<!-- source: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html s.6(6); https://laws-lois.justice.gc.ca/eng/regulations/SOR-2013-221/FullText.html s.3(b); checked 2026-10-14 -->
- **Sends when:** a quote is open and unanswered. Up to {QUOTE_FOLLOWUPS} messages, spaced
  {QUOTE_SPACING_DAYS} days apart. Stops at the first reply or STOP.

Delivering the quote:

> Hi {CUSTOMER_FIRST_NAME}, here's the quote you asked for from {CLIENT_NAME}:
> {QUOTE_LINK}. Questions? Reply here or call {CLIENT_PHONE}.

Follow-up:

> Hi {CUSTOMER_FIRST_NAME}, {CLIENT_NAME} here. Any questions on the quote? Happy to walk
> through it: {CLIENT_PHONE}. Reply STOP to opt out.

## 5 · Emergency safety auto-reply (gas / CO)

- **Consent basis:** a reply to the customer's own message. Safety information, not a
  commercial message. Sent regardless of campaign windows, but never after STOP. [LAWYER]
- **Sends when:** an inbound text contains a listed keyword: gas, smell gas, carbon
  monoxide, CO alarm, CO detector. The owner is paged at the same time.
- Wording is fixed. Clients cannot edit it. Gas utility line: SaskEnergy emergency line
  {GAS_UTILITY_EMERGENCY_NUMBER} (verify the current number before go-live).

> If you smell gas or a CO alarm is sounding: leave the building now, then call 911 or
> the gas emergency line {GAS_UTILITY_EMERGENCY_NUMBER} from outside. Don't use switches
> or flames. {CLIENT_NAME} has been alerted and will call you.

## 6 · STOP and other replies

| Reply | Action | Confirmation sent |
|---|---|---|
| STOP, UNSUBSCRIBE, CANCEL, END, QUIT | Mark contact opted out for all of this client's messages | "You're unsubscribed from {CLIENT_NAME} texts. No more messages will be sent." |
| START | Re-subscribe only if the contact sent START themselves | "You're re-subscribed to {CLIENT_NAME} texts. Reply STOP to opt out." |
| HELP | No change | "{CLIENT_NAME}: {CLIENT_PHONE}, {CLIENT_WEB}. Reply STOP to opt out." |

Twilio's own opt-out keyword handling may also apply on the number; check that it and
the CRM agree. [LAWYER]

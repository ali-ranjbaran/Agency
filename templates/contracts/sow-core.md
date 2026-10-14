---
title: Statement of Work — Core (CRM and automations retainer)
kind: sow
version: 0.1
status: draft
---

# Statement of Work — Core (CRM and automations retainer)

> Draft template under the Master Services Agreement between {LEGAL_NAME} (Arkosa) and
> {CLIENT_LEGAL_NAME}. Not legal advice. [LAWYER] clauses need review.

SOW number: {SOW_NUMBER} · Start date: {START_DATE}

## What runs

| Automation | What it does | Trigger |
|---|---|---|
| Missed-call text-back | Texts the caller from the Client's number, with the Client's name | A call to the Client's number is not answered |
| Review request | One request for a Google review, at most one reminder | Client marks a job complete |
| Quote follow-up | Up to {QUOTE_FOLLOWUPS} follow-ups on an open quote; stops at the first reply | Quote sent and not answered |
| Past-customer reactivation | Seasonal tune-up message | Only customers with a job in the last 2 years, or express consent |
| Emergency reply | Gas or CO keywords get the safety reply and page the owner | Inbound text contains a listed keyword |

Every message follows `casl-wording.md`: it identifies the Client, honours STOP, and is
sent only inside its consent window.

Setup includes the CRM sub-account, phone routing (conditional forwarding tested on the
Client's carrier), and a test set of calls and texts run before go-live and after every
change.

## Monthly report

By the {REPORT_DAY} business day of each month, a one-page report: inbound and missed
calls (spam excluded), texts sent, replies, jobs the Client confirms were booked, reviews
and rating. Every number is labelled measured, client-confirmed or estimated. If the
recovered revenue is below the retainer, the report says so and proposes a fix.

## Response times

| Issue | Example | First response | Target fix |
|---|---|---|---|
| Down | Text-back not sending | {P1_RESPONSE} | {P1_FIX} |
| Degraded | One automation wrong | {P2_RESPONSE} | {P2_FIX} |
| Change request | New wording, new hours | {P3_RESPONSE} | Next scheduled change window |

- These times apply **every week of the year, including Arkosa's exam weeks**. During
  those weeks, Arkosa monitors through automated alerts and keeps the "Down" response
  time; change requests may move to the following week. Exam weeks are announced at least
  14 days ahead. [LAWYER]
- Contact for issues: {SUPPORT_EMAIL} / {SUPPORT_PHONE}.

## Fee and payment

- Monthly fee: **{PRICE_CORE_MONTHLY}**, tool costs included.
- Setup fee: **{PRICE_CORE_SETUP}** (waived when converting from an Entry free period;
  pending decision D5).
- Charged automatically each month, one month in advance.

## Term and notice

- Minimum term: the first 3 months.
- After that, **month to month**. Either party may end it with **30 days' written notice**.
  [LAWYER]
- On exit, the MSA's "On exit" clause applies: data export, number porting, then deletion.

## Optional clause — response guarantee *(pending D7 sign-off; delete if not agreed)*

> If, in a calendar month, a missed call to the Client's number does not get a text-back
> within 60 seconds because of a fault in the systems Arkosa runs, that month's fee is
> credited in full. Misses caused by the Client's carrier, the Client switching off
> forwarding, numbers on the spam blocklist, or outages at Twilio or GoHighLevel are not
> covered. The credit is the Client's only remedy for that miss. The Client claims it in
> writing within 30 days. [LAWYER]

## Not included

Website changes (Entry SOW or change order), paid ads, answering calls, call recording
(separate opt-in change), anything not listed under "What runs".

## Signatures

| | Arkosa | Client |
|---|---|---|
| Name | {SIGNATORY_NAME} | {CLIENT_SIGNATORY_NAME} |
| Signature | | |
| Date | | |

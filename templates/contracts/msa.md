---
title: Master Services Agreement
kind: contract
version: 0.1
status: draft
---

# Master Services Agreement

> Draft template. Not legal advice. Every clause tagged [LAWYER] needs review by a
> lawyer licensed in {JURISDICTION} before this is signed with any client.

## Parties

This agreement is between **{LEGAL_NAME}**, trading as Arkosa, of {MAILING_ADDRESS}
("Arkosa"), and **{CLIENT_LEGAL_NAME}**, of {CLIENT_MAILING_ADDRESS} (the "Client").

Effective date: {EFFECTIVE_DATE}.

## How this agreement works

This agreement sets the general terms. Each piece of work is described in a Statement
of Work (SOW) that both parties sign. If an SOW and this agreement disagree, the SOW
wins for that piece of work only. [LAWYER]

## Services

Arkosa provides the services named in each SOW: websites, CRM setup, automations and
related reporting. Arkosa does not answer or listen to the Client's calls.

## Fees and payment

- Fees are set in each SOW. Tool costs named in the SOW are included in the fee.
- Payment is due upfront, before work starts.
- Monthly retainers are charged automatically, one month in advance, on the same day
  each month.
- If a payment fails, Arkosa may pause automations after {GRACE_DAYS} days' written
  notice. Pausing does not delete data. [LAWYER]
- Amounts are in Canadian dollars and exclude applicable taxes (GST/PST).

## Client responsibilities

The Client:

- gives Arkosa the access the SOW lists (domain, phone carrier, Google Business Profile,
  existing customer list) within {ACCESS_DAYS} business days of signing;
- confirms that any customer list it gives Arkosa meets the consent rules in the
  Data-handling schedule below, including the 2-year rule for past customers;
- tells Arkosa within 2 business days if a customer asks to stop receiving messages
  through a channel Arkosa does not control;
- is responsible for the accuracy of its own business information (hours, prices,
  service area, licences).

## Intellectual property

- **The Client owns** its website as delivered, its domain, its content (text, photos,
  logos it supplied or paid for), and its customer data.
- **Arkosa keeps** its templates, components, code libraries, workflow designs, skills,
  checklists and know-how, including anything it reuses across clients. The Client gets
  a permanent, non-exclusive, royalty-free licence to use the parts of these that are
  built into its own website and automations. [LAWYER]
- Ownership of the delivered site passes to the Client when the related fees are paid in
  full.
- Arkosa may describe the work in its portfolio without naming the Client, unless the
  Client agrees in writing to be named.

## Automations: what is and isn't promised

- Automations depend on third-party systems: phone carriers, Twilio, GoHighLevel,
  Cloudflare, Google. Arkosa does not guarantee that an automation never misses a call,
  never sends late, or never fails to deliver a message. [LAWYER]
- Arkosa monitors the automations it runs and fixes faults within the response times in
  the Core SOW.
- Any service-level credit (for example a response guarantee) applies only if it is
  written into the SOW, and that credit is the Client's only remedy for the miss it
  covers. [LAWYER]
- Emergency replies (gas, carbon monoxide) tell the customer to leave and call 911 or the
  gas utility. They are a safety prompt, not an emergency service. The Client remains
  responsible for its own emergency response. [LAWYER]

## Confidentiality

Each party keeps the other's non-public business information confidential, uses it only
for this agreement, and returns or deletes it on request at the end. This does not
cover information that is public or that a party already had. [LAWYER]

## Liability cap

- Each party's total liability under this agreement is capped at the fees the Client paid
  Arkosa in the {CAP_MONTHS} months before the claim. [LAWYER]
- Neither party is liable for lost profits, lost jobs or indirect losses. [LAWYER]
- The cap does not apply to a party's breach of confidentiality or the Data-handling
  schedule, or to amounts the Client owes for services. [LAWYER]

## Term and ending

- This agreement runs until every SOW under it has ended.
- Each SOW sets its own term and notice period.
- Either party may end this agreement for a serious breach that is not fixed within
  {CURE_DAYS} days of written notice. [LAWYER]

## On exit

Within {EXIT_DAYS} days of the end of the last SOW, Arkosa will:

- export the Client's customer data (contacts, message history, call log) in CSV;
- transfer the website files and hand over the domain and hosting access the Client owns;
- **port the Client's phone number** (if Arkosa provisioned or holds it) to the carrier the
  Client names, and cooperate with the port request; the Client pays any carrier fee;
- then delete the Client's data from the systems Arkosa controls, and confirm in writing.

## General

- Governing law: the laws of {JURISDICTION} and the federal laws of Canada that apply.
  [LAWYER]
- Notices go by email to the addresses on the signature page.
- Neither party may assign this agreement without the other's written consent, except
  Arkosa to a successor of its business. [LAWYER]
- This agreement and its SOWs are the whole agreement on their subject.

---

## Schedule A · Data handling

> Written to align with PIPEDA's principles. Arkosa should confirm with a lawyer that
> this schedule fits how each client's data actually flows. [LAWYER]
<!-- source: OPC, PIPEDA fair information principles — https://laws-lois.justice.gc.ca/eng/acts/P-8.6/FullText.html Schedule 1; checked 2026-10-14 -->

### Roles

- The Client controls its customers' personal information and decides why it is
  collected.
- Arkosa is the Client's **service provider**. It processes that information only to
  deliver the SOW, only on the Client's instructions, and not for its own purposes.
<!-- source: OPC, accountability when transferring personal information for processing — https://laws-lois.justice.gc.ca/eng/acts/P-8.6/FullText.html Schedule 1 cl.4.1.3; https://www.priv.gc.ca/en/privacy-topics/airports-and-borders/gl_dab_090127/ ; checked 2026-10-14 -->
- The Client stays accountable to its customers for the information. Arkosa protects it
  by contract under this schedule.

### Where the data lives

| System | What it holds | Why |
|---|---|---|
| GoHighLevel | Contacts, message history, pipeline, call log | CRM and automations |
| Twilio | Phone numbers, call and SMS logs, message content | Text-back and call routing |
| Cloudflare | Website, form submissions, logs | Hosting and forms |

Some of these providers store data outside Canada (for example in the United States).
The Client is told this here so it can tell its own customers in its privacy policy.
[LAWYER]

### Safeguards

- Access limited to Arkosa's operator, using unique logins with two-factor
  authentication where the tool offers it.
- No client customer data is stored in Arkosa's source code or on personal devices
  beyond what a task needs, and temporary copies are deleted when the task ends.
- Arkosa's access to any call recording is limited to fixing faults.

### Breaches

Arkosa tells the Client within {BREACH_NOTICE_HOURS} hours of learning of a breach of
safeguards that involves the Client's customer data, with what is known, and helps the
Client meet its own reporting and record-keeping duties. [LAWYER]
<!-- source: OPC, breach of security safeguards reporting — https://laws-lois.justice.gc.ca/eng/regulations/SOR-2018-64/FullText.html ; https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/ ; checked 2026-10-14 -->

### Access and correction requests

If a customer of the Client asks Arkosa for their information, Arkosa passes the request
to the Client within 2 business days and helps the Client answer it in time.
<!-- source: OPC, access requests — https://laws-lois.justice.gc.ca/eng/acts/P-8.6/FullText.html (30-day time limit for access requests); checked 2026-10-14 -->

### Retention and deletion

- Data is kept while the SOW runs, then exported and deleted under "On exit".
- **Call audio** (only if recording is switched on under a signed SOW change): deleted
  within {AUDIO_DELETION_DAYS} days of transcription, or {AUDIO_MAX_DAYS} days after the
  call, whichever is first. Recording is off by default. [LAWYER]
- Anonymised, aggregate numbers (for example "median text-back time across clients") may
  be kept and used for benchmarks. They identify no customer and no client. [LAWYER]

### Messaging consent (CASL)

- The Client confirms that every contact it asks Arkosa to message has a valid consent
  basis, and that past-customer lists contain only customers with a purchase in the last
  2 years, or with express consent on record. [LAWYER]
<!-- source: CRTC / Government of Canada, implied consent periods — https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html s.10(9)-(10); https://web.archive.org/web/20261010210139/https://crtc.gc.ca/eng/com500/faq500.htm (CRTC FAQ via Wayback; crtc.gc.ca returned 403 directly); checked 2026-10-14 -->
- Arkosa builds the consent windows and unsubscribe handling into the workflows as set
  out in `casl-wording.md`, and keeps the records the workflows produce.
- Arkosa does not send cold SMS for the Client, ever.

---

## Signatures

| | Arkosa | Client |
|---|---|---|
| Name | {SIGNATORY_NAME} | {CLIENT_SIGNATORY_NAME} |
| Title | | |
| Email for notices | {NOTICE_EMAIL} | {CLIENT_NOTICE_EMAIL} |
| Signature | | |
| Date | | |

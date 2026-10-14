---
title: Contract pack — README
kind: contract
version: 0.1
status: draft
---

# Contract pack

Draft v0.1, written 2026-10-14 from plan v4 §1 (week 2), §2.5 B, §3.3, §10.7–10.8.
Nothing here is legal advice. Before client #1, a lawyer licensed in {JURISDICTION}
reviews the whole pack once (plan v4 estimate: $500–1,500).

| File | Kind | What it is |
|---|---|---|
| `msa.md` | contract | General terms + Schedule A, data handling |
| `sow-entry.md` | sow | Website rebuild, one week, 2 rounds, free 30-day automation period |
| `sow-core.md` | sow | Retainer: what runs, report, response times, term, optional D7 guarantee |
| `scope-statement.md` | sow | Included / not included / change handling |
| `casl-wording.md` | wording | Fixed client-side SMS wording, consent basis and expiry per message |

## Placeholders

Never fill prices in the template. Fill per client, after the call.

| Placeholder | Where | Meaning |
|---|---|---|
| `{LEGAL_NAME}` | all | Arkosa's legal name (sole proprietor or corporation) |
| `{MAILING_ADDRESS}` | msa | Arkosa's mailing address (also used in CASL footers) |
| `{JURISDICTION}` | msa, README | Province whose law governs (likely Saskatchewan) |
| `{PRICE_ENTRY}` `{PRICE_CORE_MONTHLY}` `{PRICE_CORE_SETUP}` | SOWs | Prices, set in the pricing talk |
| `{CHANGE_ORDER_RATE}` | sow-entry, scope | Hourly change-order rate |
| `{CLIENT_LEGAL_NAME}` `{CLIENT_TRADING_NAME}` `{CLIENT_MAILING_ADDRESS}` `{CLIENT_SIGNATORY_NAME}` `{CLIENT_NOTICE_EMAIL}` | all | Client details, per signing |
| `{SIGNATORY_NAME}` `{NOTICE_EMAIL}` `{SUPPORT_EMAIL}` `{SUPPORT_PHONE}` | all | Arkosa contacts |
| `{EFFECTIVE_DATE}` `{SOW_NUMBER}` `{SOW_DATE}` `{START_DATE}` `{TIMEZONE}` | all | Per signing |
| `{ACCESS_DAYS}` `{GRACE_DAYS}` `{CURE_DAYS}` `{EXIT_DAYS}` `{CAP_MONTHS}` | msa | Periods to settle (suggest 5, 7, 14, 30, 12) |
| `{BREACH_NOTICE_HOURS}` | msa | Breach notice to client (suggest 72) |
| `{AUDIO_DELETION_DAYS}` `{AUDIO_MAX_DAYS}` | msa | Only matters if recording is ever switched on (D10) |
| `{PAGE_COUNT}` `{HOSTING_TERMS}` `{WARRANTY_DAYS}` | sow-entry, scope | Build scope |
| `{P1_RESPONSE}` `{P1_FIX}` `{P2_RESPONSE}` `{P2_FIX}` `{P3_RESPONSE}` `{REPORT_DAY}` | sow-core | Response times; must be ones you can keep in exam weeks |
| `{QUOTE_FOLLOWUPS}` `{QUOTE_SPACING_DAYS}` `{TEXTBACK_COOLDOWN_HOURS}` `{REACTIVATION_PER_SEASON}` | sow-core, casl | Workflow limits |
| `{CORE_CHANGES_PER_MONTH}` `{MIGRATION_CONTACTS}` `{CHANGE_REPLY_DAYS}` | scope | Change limits |
| `{CLIENT_NAME}` `{CLIENT_PHONE}` `{CLIENT_WEB}` `{CUSTOMER_FIRST_NAME}` `{REVIEW_LINK}` `{QUOTE_LINK}` | casl | Merge fields filled by the CRM at send time |
| `{GAS_UTILITY_EMERGENCY_NUMBER}` | casl | Verify the current SaskEnergy emergency number before go-live |

## What the lawyer must check

Every `[LAWYER]` tag marks a clause written by a non-lawyer. Counts at v0.1: msa 20,
sow-entry 3, sow-core 4, casl-wording 11. The main questions:

1. **MSA structure.** SOW-over-MSA precedence, assignment, governing law and the
   province-specific consumer or e-commerce rules that might apply to small businesses.
2. **IP split.** Client owns the site and content; Arkosa keeps templates and skills with a
   licence back. Is the licence wide enough that the client can move hosts freely?
3. **Liability.** Cap at {CAP_MONTHS} months of fees, exclusion of lost jobs, and the
   carve-outs. Does the "no guarantee an automation never misses" clause hold up next to
   the optional D7 credit?
4. **Emergency auto-reply.** Is the gas/CO safety text a liability risk for Arkosa or the
   client, and is the "safety prompt, not an emergency service" clause enough? Is E&O
   insurance needed (plan §10.8, R13)?
5. **Schedule A.** Service-provider role under PIPEDA, cross-border storage notice
   (Twilio, GHL, Cloudflare in the US), breach-notice timing, audio deletion window.
6. **CASL.**
   - Is a missed-call text-back a reply to an inquiry with implied consent, and does it
     need the full ID and unsubscribe content?
   - Is a review request a commercial electronic message?
   - Is the "contact details via link" approach acceptable inside 160-character SMS?
   - Who is the "sender" when Arkosa's system sends in the client's name, and does Arkosa
     need to be identified too?
   - Is the emergency reply outside CASL as a non-commercial safety message?
   - Does the client's warranty about its customer list shift enough risk to the client?
7. **Retainer terms.** 3-month minimum then 30 days' notice; auto-charge in advance;
   pausing on failed payment.
8. **D7 guarantee** (optional clause in `sow-core.md`), only if D7 is signed off.

## Sources

Checked 2026-10-14. crtc.gc.ca refused direct requests (HTTP 403), so CRTC pages were read
through Wayback Machine snapshots, and are labelled as such in the comments. CRTC
Information Bulletin 2012-548 could not be loaded. Bill C-27 (CPPA) never passed; its
successor Bill C-36 was at second reading on 2026-10-14, so PIPEDA still applies
(https://www.parl.ca/legisinfo/en/bill/45-1/c-36). Re-check before the lawyer review.

## Rules for using the pack

- Never send a contract with a price before the call (CLAUDE.md).
- Every client gets the same casl-wording; a client cannot edit consent windows or the
  emergency text.
- When the pack changes, bump `version`, keep `status: draft` until the lawyer review is
  done, then set `status: reviewed` with the date.

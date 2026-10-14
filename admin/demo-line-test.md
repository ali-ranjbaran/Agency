# Demo line test log

Plan v4 §1 week 2 · Phase 0 exit (a): demo number live, 3 test calls from 2 carriers.
Code: `setup/website/arkosa-site/functions/api/twilio/` + `server/demo-line.ts`.
**Last 4 digits only. Never a full phone number in this file.**

## Local (no real calls)

| Date | Command | Result |
|---|---|---|
| 2026-10-13 | `npm run test:demo-line` | 9/9 unit tests (signature, keywords, NANP), all 27 end-to-end checks passed. Text-back reached the mock Twilio in 13 ms. Daily and monthly caps each sent exactly one (simulated) alert email. D1 held hashes + last 4 only. |

## Live

Demo number: …____ · Deployed: ____ · Caps at test time: __/day, __/month, 1 per __ min

Time each text from the moment the busy signal starts; cross-check against the Twilio message log.

| # | Date / time (SK) | Caller …last 4 | Carrier | Busy heard? | Text received? | Seconds | Reply → canned answer? | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |

**STOP / START** (one phone)

| Step | Expected | Result |
|---|---|---|
| Text STOP | Twilio's confirmation, nothing from us | |
| Call again | Busy, **no** text; `demo_calls.skip_reason = opted_out` | |
| Text START | Twilio's confirmation | |
| Call after 10 min | Text arrives again | |

**Cap** (deploy with `DEMO_SMS_PER_DAY = "2"`, then back to 50)

| Step | Expected | Result |
|---|---|---|
| Calls from 3 different phones | 2 texts, 3rd gets none (`skip_reason = daily_cap`) | |
| Alert email | Exactly one, subject "Demo line: daily cap hit" | |
| Cap restored to 50 and redeployed | `wrangler.toml` back to 50 | |

**Signature**

| Step | Expected | Result |
|---|---|---|
| `curl -X POST https://thearkosa.com/api/twilio/voice -d From=x` (no signature) | 403 | |

## Verdict

- [ ] 3 calls, 2 carriers, every text under 10 s
- [ ] STOP blocks, START restores
- [ ] Cap blocks and alerts once
- [ ] `demo_calls` rows: hashes + last 4 only

---
title: Ideal customer profile and universe count
kind: admin
version: 0.1
status: draft
---

# ICP · HVAC · Saskatoon

Counted 2026-10-14 from public sources only (plan v4 §1 week 1). No firm names in this file;
the firm-level list is at `~/Arkosa-leads/universe/2026-10-14.csv` (outside git).

## Who

Owner-operated HVAC firms in Saskatoon city limits that answer their own phones: furnace,
AC, heat pump, maintenance. Excluded: duct/furnace-cleaning-only firms, supply houses and
manufacturers, national rental chains, firms based in surrounding towns (Warman, Dundurn,
Hague and others), "mechanical" firms with no heating category.

## Count

| | Firms |
|---|---|
| **Documented, deduplicated** | **19** (a floor, not the market) |
| Estimated real universe | 35–60 *(est.)* |
| Residential | 7 |
| Mixed | 5 |
| Commercial only | 0 |
| Unknown | 7 |

Segment comes from keywords on each firm's own homepage (residential / homeowner vs
commercial / industrial / institutional). Unknown = page didn't load or was unclear.

Why 19 is low: BBB's robots.txt blocks every listing page after the first (15 firms per
category visible; BBB reports 67 and 157 results "near Saskatoon", including other towns),
HRAI's locator needs a form submission, Yably returns 403. Plan v4 §0.3 cited 33 and 37 from
two directories.

## Sources (checked 2026-10-14)

| Source | URL | Used | Firms | Only here | Notes |
|---|---|---|---|---|---|
| BBB categories | https://www.bbb.org/ca/sk/saskatoon/category/heating-and-air-conditioning (+7 related) | Partly | 12 | 7 | Page 1 only (robots.txt); profile pages allowed |
| City of Saskatoon HELP contractor list | https://www.saskatoon.ca/sites/default/files/UE-SA_HELP_ContractorList_2026-Jan27.pdf | Yes | 10 | 5 | Official list, Jan 2026 |
| OpenStreetMap (Overpass) | https://overpass-api.de/api/interpreter | Yes | 3 | 1 | Sparse; © OpenStreetMap contributors (ODbL) |
| City of Saskatoon open data | https://data-citysaskatoon.opendata.arcgis.com | No | — | — | No business-licence dataset published |
| HRAI contractor locator | https://portal.hrai.ca/contractorlocator | No | — | — | Results only after a form submit; not used |
| Yably | https://yably.ca | No | — | — | 403 |
| PublicLeads | https://publicleads.ca | No | — | — | No reachable listing |

Overlap: BBB∩HELP 4, BBB∩OSM 1, HELP∩OSM 1.

## Dedupe rules

1. Same registrable website domain → same firm.
2. Else same E.164 phone.
3. Else same name after lowercasing and stripping punctuation and Ltd/Inc/Corp.
Two phones for one firm: keep the one on the City list.

## Confidence

- Each listed firm is real and does HVAC: **medium** (public listing + own website).
- 19 is the whole market: **low**.
- Segment split: **low–medium** (keywords only).

Next step to raise it: the manual list work in plan §1 (Google Business Profile checks by
hand, HRAI by hand), adding firms to the CSV with source URLs.

## D2 consequence

At the §2.2 pace of 15–20 new contacts a week, 19 documented firms run out in **1–2
weeks**; a 35–60 universe lasts **2–4 weeks**. Either way the D2 trigger (b), "universe
exhausted", fires long before 200 contacts. Per the D2 default the list then extends to
Saskatoon plumbing-and-heating firms, then Regina HVAC. The extension should be researched
before week 3 of Phase 1, not when it fires.

## D6 consequence

0 commercial-only and 5 mixed of 19: the tender-alerts add-on fits at most ~25% of firms
*(low confidence)*. Forecast its attach from the mixed + commercial count, per D6.

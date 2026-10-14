# report.md shape (written by scripts/lib/result.mjs)

```
LAUNCH BLOCKED | NOT CLEARED: n item(s) need a human | CLEARED      ← line 1, always

# qa-site report: <url>
Mode **<mode>** · started … · finished … · repo `<path>`
PASS n · FAIL n · UNVERIFIED n · N/A n

## FAIL: blocks launch (n)
### <id>: <title>
- <evidence…>
- **Fix:** <what to do>

## UNVERIFIED: needs a human (never counted as a pass) (n)
### <id>: <title>
- <evidence…>
- **To verify:** <exact steps, incl. the --confirm / --confirm-lead command>

## All checks
| Check | Status | Evidence |

## Artifacts
- report, checks.json, screenshots/, network.json, axe.json, lighthouse-*.json, tracking.json
```

When reporting to the operator: quote line 1, list every FAIL with its fix, then every
UNVERIFIED with its "To verify" step. Don't summarise UNVERIFIED as fine.

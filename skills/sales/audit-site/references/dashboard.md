# Ops dashboard

Internal only. Paste a website, get scored checks, proposals mapped to the offer, and a
one-click private mock. Runs on the Mac mini; reachable from your phone through Cloudflare
Access. It is never deployed to Pages and never linked from thearkosa.com.

## How it's kept private

| Layer | What it does |
|---|---|
| Both listeners bind to `127.0.0.1` | Nothing on the network can reach the Mac directly. No open ports. |
| Local listener (`PORT`, 4317) | Accepts only `Host: localhost:4317` / `127.0.0.1:4317`, which blocks DNS-rebinding pages. |
| Tunnel listener (`TUNNEL_PORT`, 4318) | The only thing cloudflared forwards to. Every request needs a valid Cloudflare Access JWT (RS256, checked against your team's certs, `aud`, `iss`, `exp`) for an email in `ACCESS_EMAILS`. Fails closed: with any Access setting empty it returns 503. |
| Cloudflare Access | Login in front of `ops.thearkosa.com` (one-time PIN to your email). Two checks: Cloudflare's edge, then the server. |
| POSTs | Need `x-arkosa-ops: 1` and a JSON body, so a cross-site page can't trigger audits. |
| Headers | Strict CSP (no third-party scripts), `noindex`, `no-store`, no framing. |
| Cost caps | `AUDITS_PER_DAY` (25), at most 5 queued, one Claude run at a time, 15-minute timeout per run. |
| URL guard | Only public http(s) sites on 80/443; private, loopback and link-local addresses are refused at every redirect. |
| Data | Audits live in `~/Arkosa-leads/` (chmod 700), outside the repo. Nothing personal is collected; the audited pages are public. |

## Local setup (10 minutes)

```bash
./install-skills.sh                                   # links audit-site into ~/.claude/skills
skills/sales/audit-site/scripts/install-dashboard.sh  # creates ~/.arkosa/ops.env, starts the agent
open http://localhost:4317
```

Optional: a PageSpeed Insights API key (Google Cloud → APIs & Services → Credentials → API
key, restricted to "PageSpeed Insights API") in `PSI_API_KEY`. It works without one at low
volume, but Google rate-limits keyless calls. Re-run the install script after editing
`ops.env`.

## Remote access (Cloudflare Tunnel + Access, about 20 minutes)

Do step 1 before step 3, so the hostname never exists without the login in front of it.
The server fails closed either way.

1. **Access application first.** Zero Trust dashboard → Access → Applications → Add →
   Self-hosted. Domain `ops.thearkosa.com`. Policy: Allow, Include → Emails →
   your email only. Login method: one-time PIN. Save, then copy the **Application Audience
   (AUD) tag** (Configure → Additional settings) and note your team domain
   (`https://<team>.cloudflareaccess.com`).
2. **Tunnel.**
   ```bash
   brew install cloudflared
   cloudflared tunnel login                 # pick thearkosa.com
   cloudflared tunnel create arkosa-ops     # note the UUID and credentials file path
   ```
   Write `~/.cloudflared/arkosa-ops.yml`:
   ```yaml
   tunnel: <UUID>
   credentials-file: /Users/<you>/.cloudflared/<UUID>.json
   ingress:
     - hostname: ops.thearkosa.com
       service: http://127.0.0.1:4318
     - service: http_status:404
   ```
3. **DNS.** `cloudflared tunnel route dns arkosa-ops ops.thearkosa.com`
4. **Server config.** In `~/.arkosa/ops.env`:
   ```
   ACCESS_TEAM_DOMAIN=https://<team>.cloudflareaccess.com
   ACCESS_AUD=<AUD tag>
   ACCESS_EMAILS=<your email>
   OPS_HOSTNAME=ops.thearkosa.com
   ```
5. Re-run `install-dashboard.sh`. It now starts the tunnel agent too.
6. **Test it's closed:** in a private window, `https://ops.thearkosa.com` must show the
   Cloudflare login, not the dashboard. `curl -s -o /dev/null -w '%{http_code}' -H 'Host:
   ops.thearkosa.com' http://127.0.0.1:4318/api/state` on the Mac must print `403`.

The Mac mini has to be awake: System Settings → Energy → "Prevent automatic sleeping when
the display is off".

## Using it

- **Run audit**: a URL, optionally "Save to" an existing website lead, so the audit sits
  next to its `brief.md` and the mock uses the lead's details.
- **Proposals**: Claude's write-up (top 3 failures, copy rewrite, improvements, "lead with",
  call questions) beside the mobile first-screen screenshot.
- **Checks**: every check with status, evidence, fix and offer. Filter by status.
- **Offer mapping**: findings grouped by L1 / Core / Local SEO and the skill that delivers each.
- **Mock**: starts `new-site.mjs --mock --seed` into `<folder>/mock/`. Then build and preview
  it as the site-starter README says. Never deploy it publicly.
- **Skills and offer map**: the skills in the repo (read live from `skills/`) and the ones
  plan v4 specs but aren't built yet.

## Troubleshooting

- "Claude didn't write audit.md": read `audit/run.log` in the audit folder. Usually `claude`
  isn't logged in for the launchd environment; run `claude` once in Terminal.
- PageSpeed checks show **unverified**: rate limit or the site blocked Google's fetcher. Add
  `PSI_API_KEY` or re-run later.
- The tunnel returns 503: an Access variable is empty in `ops.env`.

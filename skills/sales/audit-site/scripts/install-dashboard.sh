#!/usr/bin/env bash
# Install (or reinstall) the ops dashboard as launchd agents on this Mac.
#   ./install-dashboard.sh            install / reload
#   ./install-dashboard.sh uninstall  remove both agents
#
# Agent 1  com.arkosa.ops-dashboard  node server.mjs, always on, 127.0.0.1 only.
# Agent 2  com.arkosa.ops-tunnel     cloudflared, only if ~/.cloudflared/arkosa-audit.yml exists
#                                    (remote access; see ../references/dashboard.md).
# Config:  ~/.arkosa/ops.env (outside the repo, chmod 600). Created on first run.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SERVER="$HERE/server.mjs"
ENV_FILE="$HOME/.arkosa/ops.env"
TUNNEL_CFG="$HOME/.cloudflared/arkosa-audit.yml"
LEADS_DIR="${LEADS_DIR:-$HOME/Arkosa-leads}"
DOMAIN="gui/$(id -u)"
AGENTS="$HOME/Library/LaunchAgents"
L1="com.arkosa.ops-dashboard"
L2="com.arkosa.ops-tunnel"

if [[ "$(uname)" != "Darwin" ]]; then echo "macOS only" >&2; exit 1; fi

for l in "$L1" "$L2"; do launchctl bootout "$DOMAIN/$l" 2>/dev/null || true; done
if [[ "${1:-}" == "uninstall" ]]; then
  rm -f "$AGENTS/$L1.plist" "$AGENTS/$L2.plist"
  echo "removed $L1 and $L2 (config kept at $ENV_FILE)"
  exit 0
fi

command -v node >/dev/null   || { echo "node not on PATH" >&2; exit 1; }
command -v claude >/dev/null || { echo "claude not on PATH (Claude Code writes the proposals)" >&2; exit 1; }
# launchd's login shell skips .zshrc, where ~/.local/bin (claude's default home) is often added.
CLAUDE_PATH="$(command -v claude)"
mkdir -p "$LEADS_DIR" "$AGENTS" "$(dirname "$ENV_FILE")"
chmod 700 "$LEADS_DIR" "$(dirname "$ENV_FILE")"

if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
# Arkosa ops dashboard. Outside the repo; never commit this file.
PORT=4317
TUNNEL_PORT=4318
AUDITS_PER_DAY=25
# PageSpeed Insights key (optional, recommended). Restrict it to the PageSpeed Insights API.
PSI_API_KEY=
# Remote access through Cloudflare Access. Leave empty to keep the dashboard local-only.
ACCESS_TEAM_DOMAIN=
ACCESS_AUD=
ACCESS_EMAILS=
OPS_HOSTNAME=
EOF
  echo "created $ENV_FILE (edit it for PageSpeed and remote access)"
fi
chmod 600 "$ENV_FILE"

write_plist() { # label, command
  cat > "$AGENTS/$1.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>-lc</string><string>$2</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>LEADS_DIR</key><string>$LEADS_DIR</string></dict>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LEADS_DIR/$1.log</string>
  <key>StandardErrorPath</key><string>$LEADS_DIR/$1.log</string>
</dict>
</plist>
EOF
  plutil -lint "$AGENTS/$1.plist" >/dev/null
  launchctl bootstrap "$DOMAIN" "$AGENTS/$1.plist"
}

# A login shell (-l) so node and claude resolve the way they do in Terminal.
write_plist "$L1" "set -a; source \"$ENV_FILE\"; set +a; export CLAUDE_BIN=\"\${CLAUDE_BIN:-$CLAUDE_PATH}\"; exec node \"$SERVER\""
PORT_LOCAL="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"
echo "installed $L1: http://localhost:${PORT_LOCAL:-4317}  (log: $LEADS_DIR/$L1.log)"

if [[ -f "$TUNNEL_CFG" ]]; then
  command -v cloudflared >/dev/null || { echo "cloudflared not on PATH: brew install cloudflared" >&2; exit 1; }
  grep -q '^ACCESS_AUD=.\+' "$ENV_FILE" || echo "warning: ACCESS_AUD is empty, so the tunnel will serve 503 until it's set" >&2
  write_plist "$L2" "exec cloudflared tunnel --config \"$TUNNEL_CFG\" run"
  echo "installed $L2 (log: $LEADS_DIR/$L2.log)"
else
  echo "remote access off (no $TUNNEL_CFG). Setup: skills/sales/audit-site/references/dashboard.md"
fi

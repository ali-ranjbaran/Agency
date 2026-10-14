#!/usr/bin/env bash
# Install (or reinstall) the console's Mac runner as launchd agents.
#   bash install-runner.sh            install / reload
#   bash install-runner.sh uninstall  remove both agents
#
# Agent 1  com.arkosa.ops-snapshots  nightly 02:30: site snapshots + Lighthouse (snapshot.mjs)
# Agent 2  com.arkosa.ops-jobs       every 2 min: claim and run queued lead searches (jobs.mjs)
# Agent 3  com.arkosa.ops-qa         every 15 min: upload new ~/Arkosa-leads/qa/*/report.md (qa-upload.mjs)
# Config:  ~/.arkosa/ops-runner.env (outside the repo, chmod 600). Created on first run.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ENV_FILE="$HOME/.arkosa/ops-runner.env"
LOG_DIR="$HOME/.arkosa/logs"
AGENTS="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"
L1="com.arkosa.ops-snapshots"
L2="com.arkosa.ops-jobs"
L3="com.arkosa.ops-qa"

if [[ "$(uname)" != "Darwin" ]]; then echo "macOS only" >&2; exit 1; fi
for l in "$L1" "$L2" "$L3"; do launchctl bootout "$DOMAIN/$l" 2>/dev/null || true; done
if [[ "${1:-}" == "uninstall" ]]; then
  rm -f "$AGENTS/$L1.plist" "$AGENTS/$L2.plist" "$AGENTS/$L3.plist"
  echo "removed $L1, $L2 and $L3 (config kept at $ENV_FILE)"
  exit 0
fi

# launchd's shell doesn't read .zshrc, so bake in node's absolute path now.
NODE="$(command -v node)" || { echo "node not on PATH" >&2; exit 1; }
[[ -d "$HERE/node_modules/playwright" ]] || { echo "run: cd $HERE && npm install && npx playwright install chromium" >&2; exit 1; }
mkdir -p "$LOG_DIR" "$AGENTS" "$(dirname "$ENV_FILE")"
chmod 700 "$(dirname "$ENV_FILE")" "$LOG_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
# Arkosa ops runner. Outside the repo; never commit this file.
OPS_URL=https://ops.thearkosa.com
# Cloudflare Access service token "arkosa-runner" (Zero Trust → Access → Service auth).
CF_ACCESS_CLIENT_ID=
CF_ACCESS_CLIENT_SECRET=
# Google Places API (New) key, restricted to the Places API. Empty = the Places source is off.
GOOGLE_PLACES_KEY=
SNAPSHOT_DELAY_SEC=20
EOF
  echo "created $ENV_FILE: fill in the service token"
fi
chmod 600 "$ENV_FILE"

write_plist() { # label, script, schedule-xml
  cat > "$AGENTS/$1.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$HERE/$2</string></array>
  <key>WorkingDirectory</key><string>$HERE</string>
  $3
  <key>StandardOutPath</key><string>$LOG_DIR/$1.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/$1.log</string>
</dict>
</plist>
EOF
  plutil -lint "$AGENTS/$1.plist" >/dev/null
  launchctl bootstrap "$DOMAIN" "$AGENTS/$1.plist"
}

write_plist "$L1" snapshot.mjs '<key>StartCalendarInterval</key><dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>30</integer></dict>'
echo "installed $L1: nightly 02:30 (log: $LOG_DIR/$L1.log)"
if [[ -f "$HERE/jobs.mjs" ]]; then
  write_plist "$L2" jobs.mjs '<key>StartInterval</key><integer>120</integer>'
  echo "installed $L2: every 2 min (log: $LOG_DIR/$L2.log)"
fi
write_plist "$L3" qa-upload.mjs '<key>StartInterval</key><integer>900</integer>'
echo "installed $L3: every 15 min (log: $LOG_DIR/$L3.log)"
echo "snapshot one company now:  cd $HERE && npm run snapshot -- --company <id>"

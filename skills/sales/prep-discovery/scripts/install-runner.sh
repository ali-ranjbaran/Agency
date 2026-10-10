#!/usr/bin/env bash
# Install (or reinstall) the lead runner as a launchd agent on this Mac.
# Runs lead-runner.mjs every 15 minutes while you're logged in.
#   ./install-runner.sh            install / reload
#   ./install-runner.sh uninstall  remove
set -euo pipefail

LABEL="com.arkosa.lead-runner"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
RUNNER="$HERE/lead-runner.mjs"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LEADS_DIR="${LEADS_DIR:-$HOME/Arkosa-leads}"
DOMAIN="gui/$(id -u)"

if [[ "$(uname)" != "Darwin" ]]; then echo "macOS only" >&2; exit 1; fi

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
if [[ "${1:-}" == "uninstall" ]]; then
  rm -f "$PLIST"
  echo "removed $LABEL"
  exit 0
fi

command -v node >/dev/null   || { echo "node not on PATH" >&2; exit 1; }
command -v claude >/dev/null || { echo "claude not on PATH" >&2; exit 1; }
mkdir -p "$LEADS_DIR" "$HOME/Library/LaunchAgents"
chmod 700 "$LEADS_DIR"

# A login shell (-l) so node, npx and claude resolve the same way they do in Terminal.
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string><string>-lc</string>
    <string>exec node "$RUNNER"</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>LEADS_DIR</key><string>$LEADS_DIR</string></dict>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LEADS_DIR/runner.log</string>
  <key>StandardErrorPath</key><string>$LEADS_DIR/runner.log</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootstrap "$DOMAIN" "$PLIST"
echo "installed $LABEL: every 15 min, log at $LEADS_DIR/runner.log"
echo "run now:  launchctl kickstart -k $DOMAIN/$LABEL"

#!/usr/bin/env bash
# qa-site: install the script dependencies and Playwright's Chromium (the browser is shared
# with other Playwright installs on this Mac, so it's usually already cached).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
command -v node >/dev/null || { echo "node not on PATH" >&2; exit 1; }
npm install --no-fund --no-audit
npx playwright install chromium
echo "qa-site ready: node $(pwd)/qa.mjs <url> --mode client-staging|production|prospect-preview"

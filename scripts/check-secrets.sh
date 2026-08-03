#!/usr/bin/env bash
#
# Fails if provider API keys could reach the browser.
#
# On 2026-08-02 the Anthropic, OpenAI and Google keys were found in the public
# production bundle. They had been read via VITE_-prefixed env vars, which Vite
# inlines into client JavaScript at build time. This script exists so that
# cannot happen again without CI going red.
#
#   ./scripts/check-secrets.sh          checks src/ only
#   ./scripts/check-secrets.sh --built  also scans dist/ (run after a build)

set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
report() { echo "  ✗ $1"; fail=1; }

echo "checking source…"

# 1. VITE_-prefixed provider keys. The prefix is what makes Vite publish a
#    variable to the browser, so these must never appear.
if hits=$(grep -rnE 'VITE_(ANTHROPIC|OPENAI|GOOGLE|GEMINI|CLAUDE)[A-Z_]*' src/ api/ 2>/dev/null); then
  report "VITE_-prefixed provider key referenced (Vite inlines these into the bundle):"
  echo "$hits" | sed 's/^/      /'
fi

# 2. Provider SDKs constructed in browser code. api/ is server-side and fine.
if hits=$(grep -rn 'dangerouslyAllowBrowser' src/ 2>/dev/null); then
  report "provider SDK configured to run in the browser:"
  echo "$hits" | sed 's/^/      /'
fi

if hits=$(grep -rnE "from '(@anthropic-ai/sdk|openai|@google/generative-ai)'" src/ 2>/dev/null); then
  report "provider SDK imported into client code (route through /api/ai instead):"
  echo "$hits" | sed 's/^/      /'
fi

# 3. Literal keys committed anywhere.
if hits=$(grep -rnE 'sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}' src/ api/ scripts/ docs/ 2>/dev/null | grep -v check-secrets.sh); then
  report "literal API key in tracked source:"
  echo "$hits" | sed 's/^/      /'
fi

# 4. The built bundle — the thing users actually download.
if [ "${1:-}" = "--built" ]; then
  echo "checking dist/…"
  if [ ! -d dist ]; then
    report "dist/ not found — run 'npm run build' first"
  else
    for f in dist/assets/*.js; do
      [ -e "$f" ] || continue
      if hits=$(grep -oE 'sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{35}' "$f" 2>/dev/null | head -3); then
        report "API key present in built bundle $(basename "$f"):"
        echo "$hits" | sed -E 's/^(.{12}).*/      \1… (redacted)/'
      fi
    done
  fi
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "✓ no provider keys can reach the browser"
else
  echo "FAILED — see above. Provider keys belong in unprefixed env vars, read"
  echo "only by api/ai.js. See docs/superpowers/specs/2026-07-27-ai-proxy-design.md"
fi
exit "$fail"

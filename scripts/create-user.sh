#!/usr/bin/env bash
#
# Create a Smart Lesson Builder user with the builder role.
#
#   ./scripts/create-user.sh new.person@thinkcerca.com 'TheirPassword123!'
#
# Does all three things a working account needs:
#   1. adds the address to allowed_signup_emails (the database allowlist)
#   2. creates the auth user, email pre-confirmed
#   3. writes the profiles row with role = 'builder'
#
# Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env. The service role
# key bypasses RLS, which is why this works where the app's anon key cannot.
# Never commit that key or paste it into a browser.

set -euo pipefail

EMAIL="${1:-}"
PASSWORD="${2:-}"
ROLE="${3:-builder}"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "usage: $0 <email> <password> [role]" >&2
  echo "       role defaults to 'builder' (also: admin, designer)" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

envval() { grep "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '"'\''\r' | sed 's/[[:space:]]*$//'; }

URL="$(envval SUPABASE_URL)"; [ -z "$URL" ] && URL="$(envval VITE_SUPABASE_URL)"
KEY="$(envval SUPABASE_SERVICE_ROLE_KEY)"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env" >&2
  exit 1
fi

EMAIL_LC="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]')"

api() { curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' "$@"; }

# ── 1. allowlist ─────────────────────────────────────────────────────
echo "1/3  allowlisting $EMAIL_LC"
api -X POST "$URL/rest/v1/allowed_signup_emails" \
  -H 'Prefer: resolution=ignore-duplicates' \
  -d "{\"email\":\"$EMAIL_LC\"}" >/dev/null

# ── 2. auth user ─────────────────────────────────────────────────────
echo "2/3  creating account"
CREATED="$(api -X POST "$URL/auth/v1/admin/users" \
  -d "$(printf '{"email":"%s","password":"%s","email_confirm":true}' "$EMAIL_LC" "$PASSWORD")")"

USER_ID="$(printf '%s' "$CREATED" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null || true)"

if [ -z "$USER_ID" ]; then
  # Most likely already exists — look them up instead of failing outright.
  USER_ID="$(api "$URL/auth/v1/admin/users?page=1&per_page=1000" \
    | python3 -c "
import sys, json
users = json.load(sys.stdin).get('users', [])
print(next((u['id'] for u in users if u.get('email','').lower() == '$EMAIL_LC'), ''))
" 2>/dev/null || true)"

  if [ -z "$USER_ID" ]; then
    echo "error: could not create or find the user" >&2
    printf '%s\n' "$CREATED" >&2
    exit 1
  fi
  echo "     account already existed, reusing it"
fi

# ── 3. profile ───────────────────────────────────────────────────────
echo "3/3  setting role=$ROLE"
api -X POST "$URL/rest/v1/profiles" \
  -H 'Prefer: resolution=merge-duplicates' \
  -d "$(printf '{"id":"%s","role":"%s","updated_at":"%s"}' \
        "$USER_ID" "$ROLE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")" >/dev/null

echo
echo "done — $EMAIL_LC ($ROLE), id $USER_ID"
echo "they can sign in immediately; they'll be asked to set a display name."

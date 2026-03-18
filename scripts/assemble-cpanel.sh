#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIST="$ROOT_DIR/ctfd-react-frontend/dist"
CPANEL_ROOT="$ROOT_DIR/cpanel/public_html/CTF"

if [[ ! -d "$FRONTEND_DIST" ]]; then
  echo "Missing frontend build at $FRONTEND_DIST"
  echo "Run: npm --prefix ctfd-react-frontend run build"
  exit 1
fi

mkdir -p "$CPANEL_ROOT"
cp -R "$FRONTEND_DIST"/. "$CPANEL_ROOT"/
cp "$ROOT_DIR/backend/data/db.json" "$CPANEL_ROOT/api/data/db.json"

echo "cPanel bundle refreshed in $CPANEL_ROOT"

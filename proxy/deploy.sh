#!/usr/bin/env bash
# Deploy the proxy Worker, passing the dev tunnel origin from .dev.vars as
# ALLOWED_ORIGINS for this deploy only (keeps the ephemeral ngrok URL out of git).
# `wrangler deploy --var` overrides the empty wrangler.toml value at deploy time.
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .dev.vars ]]; then
  echo "No .dev.vars found; deploying with ALLOWED_ORIGINS from wrangler.toml." >&2
  exec wrangler deploy
fi

# Read ALLOWED_ORIGINS=... from .dev.vars (ignoring comments/blank lines).
origins="$(grep -E '^[[:space:]]*ALLOWED_ORIGINS=' .dev.vars | tail -n1 | cut -d= -f2-)"

if [[ -z "$origins" ]]; then
  echo "ALLOWED_ORIGINS is empty in .dev.vars; deploying without an override." >&2
  exec wrangler deploy
fi

echo "Deploying with ALLOWED_ORIGINS=$origins" >&2
exec wrangler deploy --var "ALLOWED_ORIGINS:$origins"

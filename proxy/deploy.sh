#!/usr/bin/env bash
# Deploy the proxy Worker. Reads ALLOWED_ORIGINS and KV_NAMESPACE_ID from
# .dev.vars (gitignored) so neither value needs to live in wrangler.toml.
set -euo pipefail
cd "$(dirname "$0")"

read_var() { grep -E "^[[:space:]]*$1=" .dev.vars 2>/dev/null | tail -n1 | cut -d= -f2-; }

if [[ ! -f .dev.vars ]]; then
  echo "No .dev.vars found; deploying with values from wrangler.toml." >&2
  exec wrangler deploy
fi

origins="$(read_var ALLOWED_ORIGINS)"
kv_id="$(read_var KV_NAMESPACE_ID)"

# If a KV namespace ID is set, substitute it into a temp config and deploy from that.
if [[ -n "$kv_id" ]]; then
  tmp="$(mktemp ./wrangler.XXXXXX.toml)"
  trap 'rm -f "$tmp"' EXIT
  sed "s/YOUR_KV_NAMESPACE_ID/$kv_id/" wrangler.toml > "$tmp"
  echo "Deploying with KV_NAMESPACE_ID=$kv_id" >&2
  config_flag=(--config "$tmp")
else
  echo "KV_NAMESPACE_ID not set in .dev.vars; using wrangler.toml as-is." >&2
  config_flag=()
fi

if [[ -n "$origins" ]]; then
  echo "Deploying with ALLOWED_ORIGINS=$origins" >&2
  exec wrangler deploy "${config_flag[@]}" --var "ALLOWED_ORIGINS:$origins"
else
  exec wrangler deploy "${config_flag[@]}"
fi

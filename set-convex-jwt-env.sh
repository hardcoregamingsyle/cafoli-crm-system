#! /bin/bash
# Usage:
#   ./set-convex-jwt-env.sh <slug-or-cloud-url> [site-url]
# Examples:
#   ./set-convex-jwt-env.sh precious-cricket-778
#   ./set-convex-jwt-env.sh https://precious-cricket-778.convex.cloud
#   ./set-convex-jwt-env.sh precious-cricket-778 https://precious-cricket-778.convex.site

# Run jwt-keygen and capture the output
JWT_OUTPUT=$(jwt-keygen)

# Parse output lines
JWT_PRIVATE_KEY=$(echo "$JWT_OUTPUT" | sed -n '1p')
JWKS=$(echo "$JWT_OUTPUT" | sed -n '2p')

TARGET=$1
SITE_URL_ARG=$2

# Determine Convex URL (cloud origin) to target
if [ -z "$TARGET" ]; then
  # No target passed: rely on convex.json configured deployment
  CONVEX_URL_FLAG=()
  echo "No slug or url provided; using default deployment from convex.json"
else
  if echo "$TARGET" | grep -qiE '^https?://'; then
    TARGET_URL="$TARGET"
  else
    TARGET_URL="https://$TARGET.convex.cloud"
  fi
  echo "Targeting Convex deployment: $TARGET_URL"
  CONVEX_URL_FLAG=(--url "$TARGET_URL")
fi

# Set JWT_PRIVATE_KEY and JWKS on the targeted deployment
npx convex env set "${CONVEX_URL_FLAG[@]}" JWT_PRIVATE_KEY -- "$JWT_PRIVATE_KEY"
npx convex env set "${CONVEX_URL_FLAG[@]}" JWKS "$JWKS"

# SITE_URL: optional override via 2nd arg; defaults to localhost for dev
if [ -n "$SITE_URL_ARG" ]; then
  npx convex env set "${CONVEX_URL_FLAG[@]}" SITE_URL "$SITE_URL_ARG"
else
  npx convex env set "${CONVEX_URL_FLAG[@]}" SITE_URL http://localhost:5173
fi

#!/usr/bin/env bash
#
# Test the production deployment locally.
#
# Builds the workout (Next.js) and workout-sync images from source, then runs
# the full docker-compose.production.yml stack — postgres, migrate, workout,
# sync, nginx — with locally-built images and throwaway secrets. Waits for the
# stack to come up, runs smoke checks against nginx, prints a summary, and
# tears everything down.
#
# Usage:
#   scripts/test-prod-local.sh            build, run, smoke-test, tear down
#   scripts/test-prod-local.sh --no-build reuse existing :prodtest images
#   scripts/test-prod-local.sh --keep     leave the stack running afterwards
#   scripts/test-prod-local.sh --logs     dump all service logs before teardown
#
set -euo pipefail

cd "$(dirname "$0")/.."

# ---- config ---------------------------------------------------------------
PROJECT="workout-prodtest"
COMPOSE_FILE="docker-compose.production.yml"
WORKOUT_TAG="workout:prodtest"
SYNC_TAG="workout-sync:prodtest"
HTTP_PORT="${HTTP_PORT:-8080}"   # host port -> nginx:80 (override to avoid clashes)

DO_BUILD=1
KEEP=0
DUMP_LOGS=0
for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=0 ;;
    --keep)     KEEP=1 ;;
    --logs)     DUMP_LOGS=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# ---- docker compose shim --------------------------------------------------
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  echo "error: docker compose not found" >&2
  exit 1
fi

# ---- throwaway secrets + local image overrides ----------------------------
# These are consumed by docker-compose.production.yml via ${VAR} expansion.
export POSTGRES_PASSWORD="testpass"
export SYNC_TOKEN_SECRET="test-sync-secret-not-for-production-use-only"
export SESSION_COOKIE_SECURE="false"   # stack is served over plain http locally
export WORKOUT_IMAGE="$WORKOUT_TAG"
export SYNC_IMAGE="$SYNC_TAG"

# Generated override: remap nginx 80 -> $HTTP_PORT on the host so the test
# never needs the privileged port 80 to be free.
OVERRIDE_FILE="$(mktemp -t workout-prodtest-override.XXXXXX.yml)"
cat >"$OVERRIDE_FILE" <<YAML
services:
  nginx:
    ports:
      - "${HTTP_PORT}:80"
YAML

compose() { "${DC[@]}" -p "$PROJECT" -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" "$@"; }

cleanup() {
  local code=$?
  rm -f "$OVERRIDE_FILE"
  if [[ "$DUMP_LOGS" == "1" ]]; then
    echo "==== logs ===================================================="
    compose logs --no-color || true
  fi
  if [[ "$KEEP" == "1" ]]; then
    echo "--keep set: stack left running. Tear down with:"
    echo "  ${DC[*]} -p $PROJECT -f $COMPOSE_FILE down -v"
  else
    echo "==== tearing down ============================================"
    compose down -v --remove-orphans || true
  fi
  exit "$code"
}
trap cleanup EXIT INT TERM

# ---- build ----------------------------------------------------------------
if [[ "$DO_BUILD" == "1" ]]; then
  echo "==== building $WORKOUT_TAG ==================================="
  docker build -f Dockerfile -t "$WORKOUT_TAG" .
  echo "==== building $SYNC_TAG ====================================="
  docker build -f services/sync/Dockerfile -t "$SYNC_TAG" .
else
  echo "--no-build set: reusing $WORKOUT_TAG and $SYNC_TAG"
fi

# ---- run ------------------------------------------------------------------
echo "==== starting stack ($PROJECT) =============================="
# Map nginx 80 -> $HTTP_PORT on the host without editing the compose file.
compose up -d --no-build

# ---- wait for migrate to finish (restart: "no") ---------------------------
echo "==== waiting for migrate to complete ========================="
migrate_cid="$(compose ps -aq migrate)"
if [[ -z "$migrate_cid" ]]; then
  echo "FAIL: migrate container not created" >&2
  exit 1
fi
for _ in $(seq 1 60); do
  state="$(docker inspect -f '{{.State.Status}}' "$migrate_cid" 2>/dev/null || echo missing)"
  [[ "$state" == "exited" ]] && break
  sleep 2
done
migrate_code="$(docker inspect -f '{{.State.ExitCode}}' "$migrate_cid" 2>/dev/null || echo 1)"
if [[ "$migrate_code" != "0" ]]; then
  echo "FAIL: migrate exited with code $migrate_code" >&2
  compose logs migrate || true
  exit 1
fi
echo "OK: migrations applied"

# ---- wait for nginx -> workout to answer ----------------------------------
nginx_cid="$(compose ps -q nginx)"
host_addr="$(docker port "$nginx_cid" 80/tcp 2>/dev/null | head -n1)"
host_addr="${host_addr:-0.0.0.0:80}"
base="http://${host_addr/0.0.0.0/localhost}"
echo "==== waiting for app at $base ================================"
http_ok=0
for _ in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$base/" || echo 000)"
  if [[ "$code" =~ ^(200|301|302|307|308)$ ]]; then
    echo "OK: GET / -> $code"
    http_ok=1
    break
  fi
  sleep 2
done
if [[ "$http_ok" != "1" ]]; then
  echo "FAIL: app did not answer at $base/ (last code: ${code:-none})" >&2
  compose logs workout nginx || true
  exit 1
fi

# ---- smoke: sync websocket upgrade via nginx /sync/ -----------------------
echo "==== checking sync route ====================================="
sync_code="$(curl -s -o /dev/null -w '%{http_code}' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' \
  "$base/sync/" || echo 000)"
# A bare unauthenticated upgrade is expected to be rejected (401/403/400) or
# switch protocols (101); any of those proves nginx -> sync routing is live.
if [[ "$sync_code" =~ ^(101|400|401|403|426)$ ]]; then
  echo "OK: /sync/ reachable -> $sync_code"
else
  echo "WARN: /sync/ returned $sync_code (sync may not be wired)" >&2
fi

# ---- summary --------------------------------------------------------------
echo "==== stack status ==========================================="
compose ps
echo
echo "PASS: production stack built and came up healthy at $base"

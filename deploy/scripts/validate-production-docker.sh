#!/usr/bin/env bash

set -euo pipefail

env_file="${1:-}"
compose_file="${2:-docker-compose.prod.yml}"
edge_port="${EDGE_HTTP_PORT:-8080}"
compose=(docker compose --env-file "$env_file" -f "$compose_file")

if [[ -z "$env_file" || ! -f "$env_file" ]]; then
  echo "Usage: $0 <env-file> [compose-file]" >&2
  exit 2
fi

wait_for_healthy() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local deadline=$((SECONDS + timeout_seconds))
  local container_id
  local status

  container_id="$("${compose[@]}" ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    echo "No container found for service: $service" >&2
    return 1
  fi

  while (( SECONDS < deadline )); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
    if [[ "$status" == "healthy" ]]; then
      echo "$service is healthy"
      return 0
    fi
    if [[ "$status" == "exited" || "$status" == "dead" ]]; then
      echo "$service stopped before becoming healthy (status: $status)" >&2
      return 1
    fi
    sleep 2
  done

  echo "Timed out waiting for $service to become healthy" >&2
  return 1
}

echo "Validating the production Compose model"
"${compose[@]}" config --quiet
"${compose[@]}" --profile bootstrap config --quiet

echo "Auditing production network exposure and bootstrap profile"
compose_json="$("${compose[@]}" --profile bootstrap config --format json)"
COMPOSE_JSON="$compose_json" node <<'NODE'
const model = JSON.parse(process.env.COMPOSE_JSON);
for (const service of ['postgres', 'backend']) {
  if (model.services?.[service]?.ports?.length) {
    throw new Error(`${service} must not publish host ports`);
  }
}
if (!model.services?.bootstrap?.profiles?.includes('bootstrap')) {
  throw new Error('bootstrap service must remain behind the bootstrap profile');
}
NODE

echo "Building production images"
"${compose[@]}" build

echo "Validating the Caddyfile with the production edge image"
"${compose[@]}" run --rm --no-deps edge \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "Starting the production stack without the bootstrap profile"
"${compose[@]}" up -d

bootstrap_container="$(docker ps --all --quiet \
  --filter label=com.docker.compose.project=estoque-med-production \
  --filter label=com.docker.compose.service=bootstrap)"
if [[ -n "$bootstrap_container" ]]; then
  echo "bootstrap started during the normal production startup" >&2
  exit 1
fi

migrate_id="$("${compose[@]}" ps --all -q migrate)"
if [[ -z "$migrate_id" ]]; then
  echo "Migration container was not created" >&2
  exit 1
fi
if [[ "$(docker inspect --format '{{.State.Status}}:{{.State.ExitCode}}:{{.RestartCount}}' "$migrate_id")" != "exited:0:0" ]]; then
  echo "Migration did not complete exactly once with exit code 0" >&2
  exit 1
fi

wait_for_healthy postgres
wait_for_healthy backend
wait_for_healthy edge

base_url="http://127.0.0.1:${edge_port}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

echo "Checking the production frontend"
curl --fail --silent --show-error --dump-header "$tmp_dir/root.headers" \
  --output "$tmp_dir/root.html" "$base_url/"
grep -qi '^content-type:.*text/html' "$tmp_dir/root.headers"
grep -Eq '<div id="root"></div>' "$tmp_dir/root.html"

curl --fail --silent --show-error --dump-header "$tmp_dir/spa.headers" \
  --output "$tmp_dir/spa.html" "$base_url/dashboard"
grep -qi '^content-type:.*text/html' "$tmp_dir/spa.headers"
grep -Eq '<div id="root"></div>' "$tmp_dir/spa.html"

asset_path="$(sed -nE 's/.*(src|href)="([^"]+\.(js|css))".*/\2/p' "$tmp_dir/root.html" | tail -n 1)"
if [[ -z "$asset_path" ]]; then
  echo "No compiled JavaScript or CSS asset found in the production HTML" >&2
  exit 1
fi
curl --fail --silent --show-error --output /dev/null "$base_url$asset_path"

echo "Checking the production API proxy and request ID"
curl --fail --silent --show-error --dump-header "$tmp_dir/api.headers" \
  --output "$tmp_dir/api.body" "$base_url/api/health/ready"
grep -qi '^content-type:.*application/json' "$tmp_dir/api.headers"
grep -qi '^x-request-id:' "$tmp_dir/api.headers"

echo "Running the one-shot bootstrap twice to prove idempotency"
"${compose[@]}" --profile bootstrap run --rm bootstrap
"${compose[@]}" --profile bootstrap run --rm bootstrap

echo "Production Docker validation completed successfully"

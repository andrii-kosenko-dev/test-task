#!/usr/bin/env bash
# End-to-end smoke test against a running `docker compose up`. Usage: scripts/smoke.sh
set -euo pipefail

INGEST=${INGEST_URL:-http://localhost:3001}
ANALYTICS=${ANALYTICS_URL:-http://localhost:3002}
FRONTEND=${FRONTEND_URL:-http://localhost:8080}
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

pass() { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1" >&2; exit 1; }
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

wait_for() {
  for _ in $(seq 1 60); do curl -fsS "$1" >/dev/null 2>&1 && return 0; sleep 2; done
  fail "$1 did not become healthy"
}

echo "waiting for services"
wait_for "$INGEST/health"; wait_for "$ANALYTICS/health"; wait_for "$FRONTEND/"

echo "catalogue (seeded from the public API on first start)"
for _ in $(seq 1 60); do
  total=$(curl -fsS "$INGEST/products?pageSize=1" | json "d['total']")
  [ "$total" -gt 0 ] && break; sleep 2
done
[ "$total" -gt 100 ] && pass "seeded $total products" || fail "catalogue is empty ($total)"

page=$(curl -fsS "$INGEST/products?page=1&pageSize=10")
[ "$(echo "$page" | json "len(d['items'])")" = 10 ] && pass "paging returns a full second page" || fail "paging"

hits=$(curl -fsS "$INGEST/products?q=masc" | json "[i['title'] for i in d['items']]")
echo "$hits" | grep -qi mascara && pass "prefix search 'masc' finds mascara" || fail "search: $hits"

[ "$(curl -fsS "$INGEST/products/titles" | json "len(d)")" -gt 100 ] && pass "titles endpoint" || fail "titles"
[ "$(curl -fsS "$FRONTEND/api/products?pageSize=1" | json "d['total']")" -gt 0 ] && pass "frontend nginx proxies /api" || fail "proxy"

echo "fetch to file and re-import"
fetched=$(curl -fsS -X POST "$INGEST/products/fetch")
xlsx=$(echo "$fetched" | json "[f['name'] for f in d['export']['files'] if f['format']=='xlsx'][0]")
jsonf=$(echo "$fetched" | json "[f['name'] for f in d['export']['files'] if f['format']=='json'][0]")
pass "exported $xlsx and $jsonf"
curl -fsS "$INGEST/products/exports/$xlsx" -o "$OUT/p.xlsx"; curl -fsS "$INGEST/products/exports/$jsonf" -o "$OUT/p.json"
for f in p.xlsx p.json; do
  res=$(curl -fsS -F "file=@$OUT/$f" "$INGEST/products/import")
  [ "$(echo "$res" | json "d['invalidCount']")" = 0 ] && [ "$(echo "$res" | json "d['updated']")" -gt 100 ] \
    && pass "re-import $f is idempotent ($(echo "$res" | json "d['updated']") updated)" || fail "import $f: $res"
done
printf '[{"id":999001,"title":"Smoke Test Item","category":"test","price":1.5,"images":[]},{"id":"bad"}]' >"$OUT/mix.json"
res=$(curl -fsS -F "file=@$OUT/mix.json" "$INGEST/products/import")
[ "$(echo "$res" | json "(d['inserted'],d['invalidCount'])")" = "(1, 1)" ] && pass "invalid rows are reported, valid ones stored" || fail "mixed import: $res"

echo "events -> analytics logs"
sleep 2
logs=$(curl -fsS "$ANALYTICS/logs?type=products.searched&pageSize=5")
[ "$(echo "$logs" | json "d['total']")" -gt 0 ] && pass "search events were logged" || fail "no logs: $logs"
from=$(date -u -d '-1 hour' +%FT%TZ)
[ "$(curl -fsS "$ANALYTICS/logs?from=$from&service=ingest-service" | json "d['total']")" -gt 0 ] && pass "date + service filters" || fail "filters"

echo "PDF report (analytics -> RedisTimeSeries -> Go gRPC)"
curl -fsS "$ANALYTICS/reports/pdf?from=$from" -o "$OUT/report.pdf"
head -c 5 "$OUT/report.pdf" | grep -q '%PDF-' && pass "PDF generated ($(stat -c %s "$OUT/report.pdf") bytes)" || fail "not a PDF"

echo "all smoke checks passed"

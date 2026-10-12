# Backend

Three services behind one `docker compose up --build`. Design rationale is in [BACKEND_PLAN.md](BACKEND_PLAN.md).

```
                 ┌──────────────┐   /api/*    ┌─────────────────┐  TS.ADD + pub/sub  ┌───────┐
 browser ───────▶│ frontend:8080│────────────▶│ ingest-service  │───────────────────▶│ redis │
                 │ (nginx)      │             │ :3001  (NestJS) │                    │ stack │
                 └──────────────┘             └───────┬─────────┘                    └───┬───┘
                                                      │ Mongo `catalog`       event      │ TS.MRANGE
                                              ┌───────▼───────┐             subscription │
                                              │     mongo     │◀──────┐                  │
                                              └───────────────┘       │            ┌─────▼───────────┐ gRPC  ┌────────────────┐
                                                           Mongo `analytics`       │analytics-service│──────▶│ report-service │
                                                                      └────────────│ :3002  (NestJS) │  PDF  │ :50051  (Go)   │
                                                                                   └─────────────────┘◀──────└────────────────┘
```

| Service | Swagger | Notes |
|---------|---------|-------|
| ingest-service | http://localhost:3001/docs | products search, fetch to JSON/XLSX, import |
| analytics-service | http://localhost:3002/docs | logs, PDF report |
| report-service | gRPC reflection on :50051 | `backend/proto/report.proto` is the contract |

## Commands

Run in `backend/` (Node 22): `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, one spec: `npx jest <name>`.
Go (`backend/report-service`): `go test ./...`; after editing the proto, `make proto`. Generated stubs are committed.
End to end: `docker compose up --build -d && scripts/smoke.sh`.

## Layout

- `apps/ingest-service`, `apps/analytics-service`: HTTP controllers are thin; logic lives in services, pure helpers (`search-tokens`, `search-pipeline`, `product-row`, `log-filter`, `bucket`) are unit tested without Nest or Mongo.
- `libs/common` (event types, config, paging), `libs/mongo` (official `mongodb` driver module), `libs/redis` (official `redis` client module + typed `TimeSeriesService`), `libs/messaging` (Redis transporter, `EventPublisher`, `@EmitsEvent` + interceptor). Libs never import apps.
- Import via `@app/<lib>` aliases (mirrored in `tsconfig.json`, `jest.config.js`).

## Rules

1. TDD: write the failing spec first; commit per coherent change (conventional commits).
2. New endpoint that is an "API action" gets `@EmitsEvent(EVENT_TYPES.X, ...)`; add the type to `EVENT_TYPES` in `libs/common`. Every event becomes a Redis pub/sub message, a `TS.ADD` on `events:<type>`, and (through analytics) a Mongo log.
3. Validate untrusted input at the edge: DTOs with `class-validator` for HTTP (global `ValidationPipe`, `forbidNonWhitelisted`), `parseProductRow` for file rows.
4. Telemetry must never fail a request (`EventPublisher` swallows and logs sink errors).

## Behaviour worth knowing

- **Search**: products store `searchTokens` (word prefixes, min 2 letters), indexed multikey. A query is AND of token prefixes; ranking is title > brand/category > description, then id. Paging is `$skip/$limit` and the total comes from the same `$facet`. Only prefix matches count (no mid-word substrings).
- **Import**: JSON (array or `{products: []}`) and XLSX (header row), streamed from disk, validated per row, written with unordered `bulkWrite` upserts keyed on `id` (idempotent). Up to 100 invalid rows are reported with their row number.
- **Seeding**: with `SEED_ON_START=true` (default in compose) an empty catalogue is filled from dummyjson.com on boot, and the files are saved in the `exports` volume.
- **Logs** are deduplicated by event id. Time series samples use duplicate policy `SUM`, 30-day retention.
- **Reports**: `GET /reports/pdf?from&to&bucketSeconds`; bucket defaults to a round size giving at most 60 points. The Go service densifies missing buckets to zero and returns 400-class errors as gRPC `InvalidArgument` (surfaced as 502 by analytics).

## Environment

| Variable | Default | Service |
|----------|---------|---------|
| `PORT` | 3001 / 3002 | both |
| `MONGO_URI`, `MONGO_DB` | `mongodb://localhost:27017`, `catalog` / `analytics` | both |
| `REDIS_URL` | `redis://localhost:6379` | both |
| `EXPORT_DIR`, `SEED_ON_START`, `DUMMYJSON_URL`, `IMPORT_BATCH_SIZE` | `./data/exports`, `true`, `https://dummyjson.com`, `500` | ingest |
| `REPORT_GRPC_URL`, `REPORT_PROTO_PATH` | `localhost:50051`, `./proto/report.proto` | analytics |
| `GRPC_ADDR` | `:50051` | report |

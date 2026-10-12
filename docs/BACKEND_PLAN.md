# Backend plan

## Services

| Service | Stack | Port | Role |
|---------|-------|------|------|
| `ingest-service` | NestJS | 3001 | Fetches DummyJSON products to JSON/XLSX files, parses uploaded files into Mongo, serves product search and paging to the frontend, publishes every API action as an event and as a RedisTimeSeries sample |
| `analytics-service` | NestJS (hybrid: HTTP + Redis microservice) | 3002 | Subscribes to events, stores them as logs in Mongo, exposes log queries (date, type, service), asks `report-service` for a PDF |
| `report-service` | Go, gRPC | 50051 | Renders a PDF with charts from time series data |
| `frontend` | Angular behind nginx | 8080 | `/api/*` is proxied to `ingest-service` |
| `mongo`, `redis` | `mongo:7`, `redis/redis-stack-server` (includes RedisTimeSeries) | | |

## Layout (`backend/`)

NestJS monorepo. Apps: `apps/ingest-service`, `apps/analytics-service`. Shared libs (`libs/*`, strongly typed, no app imports):

- `common`: event types and names, DTO base classes, config helpers
- `mongo`: official `mongodb` driver client provider (`MongoModule`, injection tokens)
- `redis`: official `redis` (node-redis) client provider and a typed `TimeSeriesService`
- `messaging`: Redis transporter options + `EventPublisher` (typed `emit`)

`backend/proto/report.proto` is the gRPC contract shared by analytics (client) and `report-service` (server).

## Events

Every controller action publishes `AppEvent { type, service, timestamp, payload }` with types such as `products.searched`, `products.fetched`, `products.imported`, `products.titles`, `products.exported`. Transport: Nest Redis transporter (pub/sub). In parallel ingest writes a `TS.ADD` sample to `events:<type>` labelled `{service, type}` (duplicate policy `SUM`).

## Ingest features

1. `POST /products/fetch`: pages through `https://dummyjson.com/products` and writes `data/exports/products-<ts>.{json,xlsx}`. Fully in code.
2. `POST /products/import` (multipart, JSON or XLSX): streamed parse, per-row validation, batched unordered `bulkWrite` upserts by `id`, returns `{received, inserted, updated, invalid[]}`. Idempotent.
3. Seed on start (`SEED_ON_START=true`): fetch then import when the collection is empty, so the frontend has data out of the box.
4. `GET /products?q=&page=&pageSize=`: indexed prefix search. Each product stores `searchTokens` (word prefixes, multikey index) and `titleTokens`; query tokens are ANDed with `$all`; ranking by title-token hits in the aggregation, `skip/limit` plus count in one `$facet`. `GET /products/titles` for typeahead. Unique index on `id`.

## Analytics features

- `GET /logs?type=&service=&from=&to=&page=&pageSize=`: indexes on `{type, timestamp}` and `{timestamp}`.
- `GET /reports/pdf?from=&to=&bucketSeconds=`: `TS.MRANGE` with aggregation, sent over gRPC to Go which returns PDF bytes (line chart of events over time, bar chart per type, summary table).

## TDD

Jest for Nest (unit tests with fakes for repositories/clients, written first), Go `testing` for the report renderer, Vitest for the Angular `HttpProductsApi`. Final check is an end-to-end smoke script against `docker compose up`.

## Commit order

1. plan, 2. workspace scaffold + common lib, 3. mongo/redis/messaging libs, 4. ingest: fetch+export, import, search, events, 5. analytics: subscriber, logs API, 6. Go report-service, 7. report endpoint, 8. docker-compose + Dockerfiles, 9. frontend `HttpProductsApi`, 10. docs and smoke test.

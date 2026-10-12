# Product search

Angular + NgRx frontend with a NestJS + Go backend, all containerised.

```bash
docker compose up --build        # frontend :8080, ingest :3001/docs, analytics :3002/docs
scripts/smoke.sh                 # optional end-to-end check
```

On first start the catalogue is fetched from dummyjson.com, saved as JSON/XLSX and loaded into Mongo.

- Frontend: [AGENTS.md](AGENTS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Backend: [docs/BACKEND.md](docs/BACKEND.md)

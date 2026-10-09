# Product Search (frontend)

Angular SPA with real-time search, typeahead suggestions, a virtualized card list loaded in batches, and a product detail dialog. Dark theme by default with a light-theme toggle; mobile-first and responsive.

Data currently comes from a hardcoded DummyJSON fixture behind the `ProductsApi` interface, so a backend can be dropped in later.

```bash
npm install
npm start               # http://localhost:4200
npm test                # unit + integration tests (Vitest)
npm run test:coverage   # with coverage thresholds
npm run lint
npm run build
```

See the repository root for [AGENTS.md](../AGENTS.md) and [docs/](../docs): architecture, testing strategy and conventions.

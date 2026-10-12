# AGENTS.md

Guidance for AI coding agents working in this repository. Keep it accurate: update it in the same commit as any change that makes it stale.

## What this is

A single-page product search app (Angular + NgRx). Real-time search with typeahead, a virtualized card list loaded in batches, a product detail dialog where users can draw, move and rotate one polygon per image (canvas, persisted), and dark/light themes (dark by default, toggle top right). Mobile-first and responsive.

Data comes from the backend over HTTP (`HttpProductsApi`, `/api/*`). The in-memory DummyJSON fixture (`FixtureProductsApi`) is kept only as a test double (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

- `frontend/` is the Angular app. All commands in the table below run from there.
- `backend/` is the NestJS monorepo plus the Go report service; see [docs/BACKEND.md](docs/BACKEND.md) for its commands, layout and rules.
- `docker-compose.yml` runs everything (Mongo, Redis Stack, 3 services, frontend). `scripts/smoke.sh` checks it end to end.
- `docs/PLAN.md` is the original frontend plan (T0–T13); `docs/BACKEND_PLAN.md` the backend plan.

## Commands (run in `frontend/`)

| Task | Command |
|------|---------|
| Dev server | `npm start` |
| All tests (single run) | `npm test` |
| Watch mode | `npm run test:watch` |
| Coverage (80% threshold) | `npm run test:coverage` |
| One spec file | `npx ng test --watch=false --include='**/ranking.spec.ts'` |
| Tests by name | `npx ng test --watch=false --filter='ranking'` |
| Lint | `npm run lint` |
| Production build | `npm run build` |

Before committing, `npm test`, `npm run lint` and `npm run build` must all pass.

## Stack

Angular 22 (standalone components, signals, new control flow, OnPush, no SSR, no NgModules), TypeScript strict, NgRx (`store`, `effects`, `entity`, `store-devtools`), Angular Material + CDK, Vitest via the `@angular/build:unit-test` builder (jsdom), ESLint, Prettier.

## Rules

1. **TDD.** Write the failing test first, see it fail, implement, see it pass. Run the tests as soon as they exist.
2. **Commit after each coherent change**, using conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
3. **Keep `ProductsApi` the only data seam.** Components and the store never import the fixture or call HTTP directly. Specs that need data provide `FixtureProductsApi` explicitly.
4. **Search logic stays pure** (`core/search`, `core/suggest`): no Angular or store imports, so it is trivially testable.
5. **Mobile-first CSS.** Base styles target the smallest viewport; enhance with `min-width` media queries. Touch targets are at least 44px.
6. **Theme via Material system tokens** (`var(--mat-sys-*)`). Never hardcode colors; both themes must work.
7. **Virtual scroll needs fixed row height.** If you change card height, change `ROW_HEIGHT` in `product-list.ts` and the `.row`/`.skeleton` heights in `product-list.scss` together.
8. **Accessibility is part of done:** labelled controls, keyboard operation, `aria-live` result count, visible focus.
9. **Verify UI changes in a real browser**, not only jsdom. jsdom has no layout, so it cannot catch visual or virtual-scroll problems.
10. Do not weaken tests or coverage thresholds to make a change pass.

## Gotchas

- `FixtureProductsApi` loads the JSON with a dynamic `import()` so it ships as its own chunk. Keep it lazy.
- Effects use `debounceTime` on the real async scheduler. Tests that cover them use `vi.useFakeTimers()`.
- `QueriesEffects` records a query only when it is the first page, has at least 2 characters and has results. The queries reducer then collapses prefix chains and evicts the least recently used entry beyond 50.
- Polygons are stored in image units (1 = image width, y up to 1/aspect), so they scale with the picture and rotation stays rigid. Rotation is baked into the points; there is no angle field. Gesture logic lives in the framework-free `PolygonEditor`; `PolygonCanvas` is only the shell.
- Canvas cannot read `light-dark()` custom properties, so `PolygonCanvas` reads resolved colors from the computed `color` / `border-top-color` of the canvas element. jsdom has no canvas: specs stub `getContext`, `getBoundingClientRect` and `ResizeObserver`.
- `app.integration.spec.ts` run alone fails its first test (cold lazy fixture import). It passes in the full suite; this predates the drawing feature.
- `mat.theme` uses `color-scheme` with `light-dark()`. `ThemeService` sets `color-scheme` on `<html>` and toggles `dark-theme` / `light-theme` classes.

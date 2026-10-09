# Implementation plan: Product Search SPA (`frontend/`)

## Decisions so far
- **Data:** a DummyJSON fixture (`/products/search`), hardcoded as JSON. Roughly 100 products are saved with `title`, `description`, `thumbnail`, `images` and `category`.
- **UI:** Angular Material and CDK, with the CDK virtual scroller.
- **Card detail:** a modal dialog.
- **Pagination:** simulated batches behind a service interface.

## Assumptions
1. **Angular:** the latest stable version, with standalone components, signals and the new control flow. No SSR and no zone-less experiments.
2. **Tests:** Vitest through the official `@angular/build:unit-test` builder (Angular 20 and later), with no Karma or Jest. Component tests use TestBed with jsdom.
3. **Package manager:** npm.
4. **Git:** one commit per task, in conventional-commit style (`feat:`, `test:`, `docs:`). Each TDD step is a red test, then green, then a commit. Since `main` has no commits yet, T0 makes the first commit.
5. **Search:** client-side over the fixture. It is case-insensitive and token-based, and results are ranked by relevance. Title match ranks above description match, and prefix match above substring match. Input is debounced by about 200 ms with `switchMap` cancellation.
6. **Responsive, mobile-first:** styles are written for the smallest viewport first and enhanced with `min-width` breakpoints (Material `Breakpoints` / CDK `BreakpointObserver` where logic needs it). The card grid goes from 1 column on mobile to 2, 3 and 4 columns on larger widths, the dialog goes full-screen on mobile, and touch targets are at least 44px.
7. **Out of scope:** the backend, auth, and e2e/Playwright tests. Vitest cannot cover the real browser scroller, so virtual-scroll behaviour is covered at the component and store level.

## Architecture
```
src/app/
  core/
    models/product.model.ts
    api/products-api.ts            # abstract ProductsApi (injection token)
    api/fixture-products-api.ts    # hardcoded data, simulated latency and paging
    data/products.fixture.json
    search/ranking.ts, tokenize.ts # pure functions
    theme/theme.service.ts         # signal, localStorage, <html> class
  store/
    products/   # actions, reducer, effects, selectors (search + paging)
    queries/    # NgRx entity adapter: SearchQuery entities + selectors
  features/
    search/     # search-bar (autocomplete), suggestions
    product-list/ # virtual-scroll grid, product-card
    product-dialog/
  layout/ header (title + theme toggle, top right)
```

- `ProductsApi` is an abstract class used as a DI token. The backend will later be a new implementation with no consumer changes.
- **Products state:** `query`, `items`, `page`, `total`, `loading` and `hasMore`. Effects use `switchMap` (so a new query cancels the old one) and `debounceTime`.
- **Queries entity state:** `SearchQuery { id: normalizedQuery, text, hits, lastUsedAt, resultCount }`, held in an `@ngrx/entity` adapter.
  - A query is saved only when it returns more than 0 results and is at least 2 characters long.
  - The key is normalized: trimmed, lower-cased and whitespace-collapsed.
  - A prefix chain is collapsed, so after `iph`, `ipho` and `iphone`, only `iphone` is kept.
  - The store holds at most N entries, evicting the least recently used. It can be persisted to localStorage, which is optional.
- **Typeahead:** two sources, merged and deduplicated.
  1. Past queries from the store, matched by prefix first and then by any word in the query (the word breakdown). Ranked by `hits` and recency.
  2. Terms from product titles. The index is built once, as a token set from the fixture. It matches by prefix on the current last word and returns the whole word or a phrase.

## Tasks (TDD: write the tests first, run them, implement, run them, commit)

**T0. Scaffold and tooling**
- `ng new frontend` with standalone components, SCSS, no SSR and strict mode.
- Set up Vitest as the test runner. Add the `test`, `test:watch` and `test:coverage` scripts, with a coverage threshold.
- Add NgRx (`store`, `effects`, `entity`, `store-devtools`), Material and CDK.
- Add ESLint and Prettier, plus `.gitignore`.
- Add a smoke test and make the initial commit.

**T1. Domain model and fixture**
- Fetch the DummyJSON search data once and save it as `products.fixture.json`.
- Add the `Product` interface.
- Tests: the fixture matches the schema, with unique ids and the required fields present.

**T2. Search logic (pure functions)**
- Build `tokenize`, `normalize`, `scoreProduct` and `rankProducts`.
- Tests: multi-token AND matching, partial words, title ranking above description ranking, case and diacritics, an empty query, a stable sort, and a table of regression cases that pins the ranking for known queries.

**T3. `ProductsApi` and fixture implementation**
- `search(query, page, pageSize)` returns `Observable<{items, total}>`.
- The fixture implementation adds simulated latency.
- Tests: paging boundaries, the last page, a query with no matches, and fake timers for the delay.

**T4. Products store (NgRx)**
- Actions: `queryChanged`, `loadNextPage`, and the success and failure actions.
- Add the reducer, selectors and effects.
- Tests: reducer tests, effect tests using `provideMockActions` and marbles (debounce, `switchMap` cancellation, ignoring `loadNextPage` while loading or when `hasMore` is false), and selector tests.

**T5. Query history store (entity adapter)**
- Reducer, `selectAll` and `selectEntities` selectors, and the eviction policy.
- An effect listens for `searchSuccess` and records the query only if it is meaningful.
- Tests: the save rules (no results means not saved, too short means not saved, and a prefix chain is collapsed), a duplicate query increments `hits`, eviction, and the optional persistence.

**T6. Suggestions**
- A title-term index plus a `selectSuggestions(prefix)` selector that merges history and title terms.
- Tests: ranking, deduplication, a limit on the number returned, matching by any word of a past query, and an empty input.

**T7. Theme**
- `ThemeService` (signal, defaults to dark, persists to localStorage, toggles a class on `<html>`) and the Material theme with light and dark tokens.
- The toggle sits in the top right corner of the header.
- Tests: the default is dark, toggling flips it and persists it, and a stored value is restored.

**T8. Search bar component**
- Typing alone triggers the search, with no button. It uses the Material autocomplete with keyboard navigation, and selecting a suggestion applies it.
- Tests: typing dispatches `queryChanged` after the debounce, suggestions render, selecting one dispatches the query, and there is no submit button.

**T9. Product list with virtual scroll and batches**
- Use `cdk-virtual-scroll-viewport` with a responsive grid, using row-chunking so a row can hold several cards. Add an infinite batch loader that requests the next batch near the end, plus loading skeletons, empty and error states, and `trackBy`.
- Tests: a batch is requested near the end, nothing is requested while loading, the empty state shows, and the viewport is mocked where jsdom needs it.

**T10. Product card and dialog**
- The card shows a thumbnail with `NgOptimizedImage` lazy loading, the title and a short description. It is clickable and keyboard-accessible.
- The dialog shows the title, description and a large image. Add a gallery if the product has more than one image.
- Tests: the card renders, clicking or pressing Enter opens the dialog, the dialog content is correct, and a broken image falls back to a placeholder.

**T11. Page integration and regression suite**
- Wire the whole page together. The integration tests use a real store with the fixture API and cover typing, results, scrolling to a new batch, opening a card, and the theme.
- Add a snapshot or characterization suite for ranking and suggestions.
- Check the coverage gate.

**T12. Documentation for AI agents**
- `AGENTS.md` at the repo root, `CLAUDE.md` pointing to it, and `frontend/README.md`.
- `docs/ARCHITECTURE.md` (structure and data flow), `docs/TESTING.md` (TDD flow, how to run tests, regression policy), and `docs/CONVENTIONS.md`.
- A short note on how to swap in the backend `ProductsApi`.
- Run `/init` after T0 so CLAUDE.md reflects the real commands.

**T13. Final polish**
- A11y pass, Lighthouse-style checks, and a mobile-first responsive review at mobile, tablet and desktop widths.
- Tests: the column count follows the viewport breakpoint (mocked `BreakpointObserver`), and the dialog is full-screen on mobile.
- A production build, lint and the whole test suite green.

## Open questions
1. Should the query history persist across reloads (localStorage), or live only in memory for the session?
2. Is a minimum of 2 characters before searching and recording acceptable, or should it search from the first character?
3. Should the five reference repos be skimmed before implementation to align on conventions?

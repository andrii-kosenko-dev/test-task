# Architecture

## Overview

```
 SearchBar ──queryChanged──▶ ProductsEffects ──searchRequested──▶ ProductsApi
    ▲  (typing only)           (debounce 200ms,                   (fixture today,
    │                           normalize, dedupe)                 HTTP later)
    │                                 │                                │
 SuggestionsService                   ▼                                ▼
  ▲        ▲                    products store ◀──searchSucceeded── switchMap
  │        │                          │
 queries   term index                 ▼
 store     (titles)             ProductList (virtual scroll) ──select──▶ ProductDialog
  ▲                                   │
  └── QueriesEffects ◀── searchSucceeded (first page, ≥2 chars, has results)
```

## Source layout (`frontend/src/app`)

| Path | Responsibility |
|------|----------------|
| `core/models` | `Product`, `ProductPage` types |
| `core/api` | `ProductsApi` (abstract, DI token) and `FixtureProductsApi` (lazy-loaded JSON, simulated latency and paging) |
| `core/data` | `products.fixture.json`: 194 DummyJSON products |
| `core/search` | Pure `normalize` / `tokenize` and `scoreProduct` / `rankProducts` |
| `core/suggest` | Pure `buildTermIndex` and `suggest` (typeahead) |
| `core/theme` | `ThemeService`: signal, localStorage, `<html>` class and `color-scheme` |
| `store/products` | Search results, paging, loading and error state, plus the effects |
| `store/queries` | Entity-adapter store of remembered searches, plus the recording effect |
| `features/search` | `SearchBar` (Material autocomplete) and `SuggestionsService` |
| `features/product-list` | Virtualized grid, batch loading, skeleton, empty and error states |
| `features/product-card` | Clickable card with thumbnail |
| `features/product-dialog` | Detail dialog (gallery) and `ProductDialogService` (full-screen on mobile) |
| `features/search-page` | The single route; dispatches the initial listing |
| `layout/header` | Title and top-right theme toggle |
| `testing` | Shared test factories |

## Search and ranking

`rankProducts(products, query)` tokenizes the query and requires every token to match somewhere (AND). A token scores by best field and match kind:

| Field | Exact word | Word prefix | Substring |
|-------|-----------|-------------|-----------|
| Title | 100 | 60 | 40 |
| Brand / category | n/a | 30 | 20 |
| Description | n/a | 15 | 8 |

A contiguous phrase match in the title adds 25. Results are sorted by score, then by original order (stable). A blank query returns everything in the original order.

## Pagination and virtual scroll

- The API is zero-based: `search(query, page, pageSize)` returns `{ items, total }`. The page size is `PRODUCTS_PAGE_SIZE` (24).
- The reducer resets on a page-0 request and appends on later pages. A success for a stale query is ignored. `switchMap` cancels in-flight requests when the query changes.
- `ProductList` chunks items into rows by column count (mobile-first breakpoints: 1, 2, 3 and 4 columns at 600, 900 and 1200px) and renders them with `cdk-virtual-scroll-viewport` using `scrollWindow`, so the page itself scrolls. Rows have a fixed height (`ROW_HEIGHT`).
- When the rendered range comes within 4 rows of the end, it dispatches `loadNextPage`. The effect ignores it while a request is in flight or when nothing more is available.

## Query history and typeahead

- `QueriesEffects` records a query only when it is the first page, at least 2 characters long and has results. The reducer then:
  - increments `hits` and refreshes recency for a repeated query;
  - skips a query that is a prefix of an existing one;
  - removes stored prefixes when a longer query arrives (`iph` → `iphone` keeps only `iphone`);
  - evicts the least recently used entry beyond 50.
- `suggest()` returns past queries first, then completions of the last typed word from product-title terms. A history match is a prefix of the whole query or a word breakdown, where every typed word prefix-matches a different word of the past query, in any order. History ranks by match kind, then hits, then recency.

## Swapping in the real backend

Implement `ProductsApi` over HTTP (`search` and `titles`) and change one line in `app.config.ts`: `{ provide: ProductsApi, useClass: HttpProductsApi }`. Nothing else should need to change. Delete `core/data` and `FixtureProductsApi` afterwards. Server-side ranking will replace `rankProducts`; keep the contract (`items`, `total`, zero-based pages).

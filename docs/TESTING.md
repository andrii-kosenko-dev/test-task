# Testing

Vitest runs through the `@angular/build:unit-test` builder with jsdom. Specs sit next to the code they cover (`*.spec.ts`).

## Workflow (TDD)

1. Write a failing spec that states the behavior.
2. Run it and confirm it fails for the right reason.
3. Implement the minimum to pass.
4. Run the whole suite, lint and build; commit.

## Commands (in `frontend/`)

```
npm test                                                   # single run
npm run test:watch                                         # watch mode
npm run test:coverage                                      # 80% threshold on statements/branches/functions/lines
npx ng test --watch=false --include='**/ranking.spec.ts'   # one file
npx ng test --watch=false --filter='debounce'              # by test name
```

## Layers

| Layer | What is covered | Tools |
|-------|-----------------|-------|
| Pure logic (`core/search`, `core/suggest`) | Ranking order, partial words, AND semantics, diacritics, stability, suggestion ranking, history word breakdown | Plain Vitest, table tests |
| Fixture and API | Schema and unique ids, paging boundaries, latency | `vi.useFakeTimers` |
| Store | Reducers, selectors, effects (debounce, `switchMap` cancellation, ignored `loadNextPage`, error handling, history recording rules) | `provideMockActions`, `provideMockStore`, fake timers |
| Components | Rendering, events, accessibility attributes, fallbacks | TestBed, Material harnesses (`MatAutocompleteHarness`) |
| Integration (`app.integration.spec.ts`) | The real store, effects, fixture API and components together: load, search by typing, partial words, empty and recovery, debounce, query history, suggestions, dialog, theme | Fake timers, latency set to 0 |

## Regression policy

- The integration suite and the ranking regression tests (`ranking.spec.ts`, real-fixture cases) are the safety net. If they fail after a change, either fix the code or make a deliberate, explained change to the expectation.
- Fix a bug by first adding a spec that reproduces it.
- Never weaken a threshold or skip a test to get green.

## Limits

jsdom has no layout. Visual layout, real virtual-scroll windowing and responsive breakpoints are verified in a real browser (headless Chromium over the DevTools protocol works well) and only their logic is unit tested: `columnsFor`, `chunk`, `shouldLoadMore`, and the mobile dialog config.

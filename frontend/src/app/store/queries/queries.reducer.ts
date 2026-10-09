import { createEntityAdapter, type EntityState } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';
import { QueriesActions } from './queries.actions';

export interface SearchQuery {
  /** Normalized query text; doubles as the entity id. */
  readonly id: string;
  readonly text: string;
  readonly hits: number;
  readonly resultCount: number;
  readonly lastUsedAt: number;
}

export const MAX_STORED_QUERIES = 50;

export const queriesAdapter = createEntityAdapter<SearchQuery>({
  sortComparer: (a, b) => b.lastUsedAt - a.lastUsedAt,
});

export type QueriesState = EntityState<SearchQuery>;
export const initialQueriesState: QueriesState = queriesAdapter.getInitialState();

export const queriesFeature = createFeature({
  name: 'queries',
  reducer: createReducer(
    initialQueriesState,
    on(QueriesActions.queryRecorded, (state, { query, resultCount, timestamp }): QueriesState => {
      const existing = state.entities[query];
      if (existing) {
        return queriesAdapter.updateOne(
          { id: query, changes: { hits: existing.hits + 1, resultCount, lastUsedAt: timestamp } },
          state,
        );
      }

      const ids = state.ids as string[];
      // Already covered by a longer stored query (e.g. "iph" when "iphone" exists).
      if (ids.some((id) => id.startsWith(query))) return state;

      // Typing builds prefix chains ("iph" → "iphone"); keep only the final one.
      const superseded = ids.filter((id) => query.startsWith(id));
      let next = queriesAdapter.removeMany(superseded, state);
      next = queriesAdapter.addOne(
        { id: query, text: query, hits: 1, resultCount, lastUsedAt: timestamp },
        next,
      );

      const overflow = next.ids.length - MAX_STORED_QUERIES;
      // ids are kept sorted by recency (newest first), so the tail is the least recently used.
      return overflow > 0
        ? queriesAdapter.removeMany((next.ids as string[]).slice(-overflow), next)
        : next;
    }),
    on(QueriesActions.cleared, (): QueriesState => initialQueriesState),
  ),
  extraSelectors: ({ selectQueriesState }) => queriesAdapter.getSelectors(selectQueriesState),
});

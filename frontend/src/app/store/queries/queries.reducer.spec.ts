import { QueriesActions } from './queries.actions';
import {
  MAX_STORED_QUERIES,
  initialQueriesState,
  queriesAdapter,
  queriesFeature,
} from './queries.reducer';

const { reducer } = queriesFeature;
const record = (query: string, timestamp: number, resultCount = 3) =>
  QueriesActions.queryRecorded({ query, resultCount, timestamp });
const ids = (state: ReturnType<typeof reducer>) => queriesAdapter.getSelectors().selectIds(state);
const all = (state: ReturnType<typeof reducer>) => queriesAdapter.getSelectors().selectAll(state);

describe('queries reducer', () => {
  it('stores a new query', () => {
    const s = reducer(initialQueriesState, record('phone', 10, 7));
    expect(all(s)).toEqual([
      { id: 'phone', text: 'phone', hits: 1, resultCount: 7, lastUsedAt: 10 },
    ]);
  });

  it('increments hits and refreshes recency for a repeated query', () => {
    let s = reducer(initialQueriesState, record('phone', 10, 7));
    s = reducer(s, record('phone', 20, 8));
    expect(all(s)).toEqual([
      { id: 'phone', text: 'phone', hits: 2, resultCount: 8, lastUsedAt: 20 },
    ]);
  });

  it('collapses a prefix chain: typing "iph" → "iphone" keeps only "iphone"', () => {
    let s = reducer(initialQueriesState, record('iph', 1));
    s = reducer(s, record('iphon', 2));
    s = reducer(s, record('iphone', 3));
    expect(ids(s)).toEqual(['iphone']);
  });

  it('does not store a query that is a prefix of an existing one', () => {
    let s = reducer(initialQueriesState, record('iphone', 1));
    s = reducer(s, record('iph', 2));
    expect(ids(s)).toEqual(['iphone']);
  });

  it('keeps unrelated queries side by side', () => {
    let s = reducer(initialQueriesState, record('phone', 1));
    s = reducer(s, record('laptop', 2));
    expect([...ids(s)].sort()).toEqual(['laptop', 'phone']);
  });

  it(`evicts the least recently used entry beyond ${MAX_STORED_QUERIES}`, () => {
    let s = initialQueriesState;
    for (let i = 0; i < MAX_STORED_QUERIES; i++)
      s = reducer(s, record(`q${String.fromCharCode(97 + (i % 26))}${i}x`, i));
    expect(ids(s)).toHaveLength(MAX_STORED_QUERIES);
    s = reducer(s, record('brand new', 1000));
    expect(ids(s)).toHaveLength(MAX_STORED_QUERIES);
    expect(ids(s)).toContain('brand new');
    expect(ids(s)).not.toContain('qa0x');
  });

  it('can be cleared', () => {
    const s = reducer(reducer(initialQueriesState, record('phone', 1)), QueriesActions.cleared());
    expect(ids(s)).toEqual([]);
  });
});

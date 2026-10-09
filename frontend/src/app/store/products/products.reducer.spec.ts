import type { Product } from '../../core/models/product.model';
import { ProductsActions } from './products.actions';
import { initialProductsState, productsFeature, type ProductsState } from './products.reducer';

const p = (id: number): Product => ({
  id,
  title: `P${id}`,
  description: 'd',
  category: 'c',
  thumbnail: 't',
  images: ['i'],
  price: 1,
});

const { reducer } = productsFeature;

describe('products reducer', () => {
  it('starts idle and empty', () => {
    expect(initialProductsState).toEqual({
      query: '',
      items: [],
      total: 0,
      pagesLoaded: 0,
      loading: false,
      loaded: false,
      error: null,
    });
  });

  it('page-0 request resets results and starts loading', () => {
    const prev: ProductsState = {
      ...initialProductsState,
      query: 'old',
      items: [p(1)],
      total: 5,
      pagesLoaded: 1,
      loaded: true,
      error: 'x',
    };
    const next = reducer(prev, ProductsActions.searchRequested({ query: 'new', page: 0 }));
    expect(next).toEqual({ ...initialProductsState, query: 'new', loading: true });
  });

  it('later-page request keeps results and starts loading', () => {
    const prev: ProductsState = {
      ...initialProductsState,
      items: [p(1)],
      total: 5,
      pagesLoaded: 1,
      loaded: true,
    };
    const next = reducer(prev, ProductsActions.searchRequested({ query: '', page: 1 }));
    expect(next.items).toEqual([p(1)]);
    expect(next.loading).toBe(true);
  });

  it('page-0 success replaces results', () => {
    const prev = reducer(
      initialProductsState,
      ProductsActions.searchRequested({ query: 'a', page: 0 }),
    );
    const next = reducer(
      prev,
      ProductsActions.searchSucceeded({ query: 'a', page: 0, items: [p(1), p(2)], total: 5 }),
    );
    expect(next).toMatchObject({
      items: [p(1), p(2)],
      total: 5,
      pagesLoaded: 1,
      loading: false,
      loaded: true,
    });
  });

  it('later-page success appends results', () => {
    let s = reducer(initialProductsState, ProductsActions.searchRequested({ query: 'a', page: 0 }));
    s = reducer(
      s,
      ProductsActions.searchSucceeded({ query: 'a', page: 0, items: [p(1)], total: 2 }),
    );
    s = reducer(s, ProductsActions.searchRequested({ query: 'a', page: 1 }));
    s = reducer(
      s,
      ProductsActions.searchSucceeded({ query: 'a', page: 1, items: [p(2)], total: 2 }),
    );
    expect(s.items).toEqual([p(1), p(2)]);
    expect(s.pagesLoaded).toBe(2);
  });

  it('ignores a success for a stale query', () => {
    const prev = reducer(
      initialProductsState,
      ProductsActions.searchRequested({ query: 'new', page: 0 }),
    );
    const next = reducer(
      prev,
      ProductsActions.searchSucceeded({ query: 'old', page: 0, items: [p(9)], total: 1 }),
    );
    expect(next).toEqual(prev);
  });

  it('records a failure and stops loading', () => {
    const prev = reducer(
      initialProductsState,
      ProductsActions.searchRequested({ query: 'a', page: 0 }),
    );
    const next = reducer(prev, ProductsActions.searchFailed({ error: 'boom' }));
    expect(next).toMatchObject({ loading: false, error: 'boom' });
  });
});

describe('products selectors', () => {
  const { selectHasMore, selectIsEmpty, selectCanLoadMore } = productsFeature;
  const root = (products: ProductsState) => ({ products });

  it('hasMore is true while fewer items than total are loaded', () => {
    const s = { ...initialProductsState, items: [p(1)], total: 3, loaded: true };
    expect(selectHasMore(root(s))).toBe(true);
    expect(selectHasMore(root({ ...s, total: 1 }))).toBe(false);
  });

  it('isEmpty only after a completed load with no results', () => {
    expect(selectIsEmpty(root(initialProductsState))).toBe(false);
    expect(selectIsEmpty(root({ ...initialProductsState, loaded: true }))).toBe(true);
    expect(selectIsEmpty(root({ ...initialProductsState, loaded: true, loading: true }))).toBe(
      false,
    );
  });

  it('canLoadMore requires hasMore and no request in flight', () => {
    const s = { ...initialProductsState, items: [p(1)], total: 3, loaded: true };
    expect(selectCanLoadMore(root(s))).toBe(true);
    expect(selectCanLoadMore(root({ ...s, loading: true }))).toBe(false);
    expect(selectCanLoadMore(root({ ...s, total: 1 }))).toBe(false);
  });
});

import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import type { Product } from '../../core/models/product.model';
import { ProductsActions } from './products.actions';

export interface ProductsState {
  /** Normalized query the current results belong to. */
  readonly query: string;
  readonly items: readonly Product[];
  readonly total: number;
  readonly pagesLoaded: number;
  readonly loading: boolean;
  /** True once the current query has completed at least one fetch. */
  readonly loaded: boolean;
  readonly error: string | null;
}

export const initialProductsState: ProductsState = {
  query: '',
  items: [],
  total: 0,
  pagesLoaded: 0,
  loading: false,
  loaded: false,
  error: null,
};

export const productsFeature = createFeature({
  name: 'products',
  reducer: createReducer(
    initialProductsState,
    on(ProductsActions.searchRequested, (state, { query, page }): ProductsState =>
      page === 0
        ? { ...initialProductsState, query, loading: true }
        : { ...state, loading: true, error: null },
    ),
    on(ProductsActions.searchSucceeded, (state, { query, page, items, total }): ProductsState =>
      query !== state.query
        ? state
        : {
            ...state,
            items: page === 0 ? items : [...state.items, ...items],
            total,
            pagesLoaded: page + 1,
            loading: false,
            loaded: true,
            error: null,
          },
    ),
    on(ProductsActions.searchFailed, (state, { error }): ProductsState => ({
      ...state,
      loading: false,
      error,
    })),
  ),
  extraSelectors: ({ selectItems, selectTotal, selectLoaded, selectLoading }) => {
    const selectHasMore = createSelector(
      selectItems,
      selectTotal,
      (items, total) => items.length < total,
    );
    return {
      selectHasMore,
      selectIsEmpty: createSelector(
        selectLoaded,
        selectLoading,
        selectTotal,
        (loaded, loading, total) => loaded && !loading && total === 0,
      ),
      selectCanLoadMore: createSelector(
        selectHasMore,
        selectLoading,
        (hasMore, loading) => hasMore && !loading,
      ),
    };
  },
});

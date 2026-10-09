import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  switchMap,
  withLatestFrom,
} from 'rxjs';
import { ProductsApi } from '../../core/api/products-api';
import { normalize } from '../../core/search/tokenize';
import { ProductsActions } from './products.actions';
import { productsFeature } from './products.reducer';

export const SEARCH_DEBOUNCE_MS = 200;
export const PRODUCTS_PAGE_SIZE = 24;

@Injectable()
export class ProductsEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly api = inject(ProductsApi);

  readonly queryChanged$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductsActions.queryChanged),
      map(({ query }) => normalize(query)),
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      map((query) => ProductsActions.searchRequested({ query, page: 0 })),
    ),
  );

  readonly loadNextPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductsActions.loadNextPage),
      withLatestFrom(
        this.store.select(productsFeature.selectCanLoadMore),
        this.store.select(productsFeature.selectQuery),
        this.store.select(productsFeature.selectPagesLoaded),
      ),
      filter(([, canLoadMore]) => canLoadMore),
      map(([, , query, page]) => ProductsActions.searchRequested({ query, page })),
    ),
  );

  readonly fetch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductsActions.searchRequested),
      switchMap(({ query, page }) =>
        this.api.search(query, page, PRODUCTS_PAGE_SIZE).pipe(
          map(({ items, total }) => ProductsActions.searchSucceeded({ query, page, items, total })),
          catchError((e: unknown) =>
            of(
              ProductsActions.searchFailed({
                error: e instanceof Error ? e.message : 'Search failed',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}

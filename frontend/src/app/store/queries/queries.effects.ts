import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { filter, map } from 'rxjs';
import { normalize } from '../../core/search/tokenize';
import { ProductsActions } from '../products/products.actions';
import { QueriesActions } from './queries.actions';

export const MIN_RECORDED_QUERY_LENGTH = 2;

/** Remembers only meaningful searches: first page, long enough, and with results. */
@Injectable()
export class QueriesEffects {
  private readonly actions$ = inject(Actions);

  readonly record$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductsActions.searchSucceeded),
      filter(
        ({ page, total, query }) =>
          page === 0 && total > 0 && normalize(query).length >= MIN_RECORDED_QUERY_LENGTH,
      ),
      map(({ query, total }) =>
        QueriesActions.queryRecorded({
          query: normalize(query),
          resultCount: total,
          timestamp: Date.now(),
        }),
      ),
    ),
  );
}

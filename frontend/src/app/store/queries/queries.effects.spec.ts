import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, Subject } from 'rxjs';
import { ProductsActions } from '../products/products.actions';
import { QueriesActions } from './queries.actions';
import { QueriesEffects } from './queries.effects';

describe('QueriesEffects', () => {
  let actions$: Subject<unknown>;
  let out: unknown[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    actions$ = new Subject();
    TestBed.configureTestingModule({
      providers: [
        QueriesEffects,
        provideMockActions(() => actions$ as unknown as Observable<never>),
      ],
    });
    out = [];
    TestBed.inject(QueriesEffects).record$.subscribe((a) => out.push(a));
  });
  afterEach(() => vi.useRealTimers());

  const succeeded = (query: string, total: number, page = 0) =>
    ProductsActions.searchSucceeded({ query, page, items: [], total });

  it('records a query that produced results', () => {
    actions$.next(succeeded('phone', 4));
    expect(out).toEqual([
      QueriesActions.queryRecorded({ query: 'phone', resultCount: 4, timestamp: 5000 }),
    ]);
  });

  it('ignores queries with no results', () => {
    actions$.next(succeeded('zzz', 0));
    expect(out).toEqual([]);
  });

  it('ignores blank and single-character queries', () => {
    actions$.next(succeeded('', 100));
    actions$.next(succeeded('a', 100));
    expect(out).toEqual([]);
  });

  it('ignores follow-up pages of the same query', () => {
    actions$.next(succeeded('phone', 40, 1));
    expect(out).toEqual([]);
  });
});

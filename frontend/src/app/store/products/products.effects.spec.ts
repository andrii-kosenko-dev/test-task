import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ProductsApi } from '../../core/api/products-api';
import type { Product } from '../../core/models/product.model';
import { ProductsActions } from './products.actions';
import { ProductsEffects, PRODUCTS_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from './products.effects';
import { initialProductsState, type ProductsState } from './products.reducer';

const p = (id: number): Product => ({
  id,
  title: `P${id}`,
  description: 'd',
  category: 'c',
  thumbnail: 't',
  images: ['i'],
  price: 1,
});

describe('ProductsEffects', () => {
  let actions$: Subject<unknown>;
  let effects: ProductsEffects;
  let search: ReturnType<typeof vi.fn>;

  const setup = (state: ProductsState = initialProductsState) => {
    actions$ = new Subject();
    search = vi.fn(() => of({ items: [p(1)], total: 1 }));
    TestBed.configureTestingModule({
      providers: [
        ProductsEffects,
        provideMockActions(() => actions$ as unknown as Observable<never>),
        provideMockStore({ initialState: { products: state } }),
        { provide: ProductsApi, useValue: { search, titles: () => of([]) } },
      ],
    });
    effects = TestBed.inject(ProductsEffects);
  };

  const collect = <T>(source$: Observable<T>): T[] => {
    const out: T[] = [];
    source$.subscribe((v) => out.push(v));
    return out;
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('debounced query', () => {
    it('emits a page-0 request after the debounce window', () => {
      setup();
      const out = collect(effects.queryChanged$);
      actions$.next(ProductsActions.queryChanged({ query: 'iph' }));
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
      expect(out).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(out).toEqual([ProductsActions.searchRequested({ query: 'iph', page: 0 })]);
    });

    it('collapses rapid typing into a single request', () => {
      setup();
      const out = collect(effects.queryChanged$);
      for (const q of ['i', 'ip', 'iph']) {
        actions$.next(ProductsActions.queryChanged({ query: q }));
        vi.advanceTimersByTime(50);
      }
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      expect(out).toEqual([ProductsActions.searchRequested({ query: 'iph', page: 0 })]);
    });

    it('normalizes the query and skips repeats', () => {
      setup();
      const out = collect(effects.queryChanged$);
      actions$.next(ProductsActions.queryChanged({ query: ' Phone ' }));
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      actions$.next(ProductsActions.queryChanged({ query: 'phone' }));
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      expect(out).toEqual([ProductsActions.searchRequested({ query: 'phone', page: 0 })]);
    });
  });

  describe('fetch', () => {
    it('calls the api with the page size and reports success', () => {
      setup();
      const out = collect(effects.fetch$);
      actions$.next(ProductsActions.searchRequested({ query: 'a', page: 2 }));
      expect(search).toHaveBeenCalledWith('a', 2, PRODUCTS_PAGE_SIZE);
      expect(out).toEqual([
        ProductsActions.searchSucceeded({ query: 'a', page: 2, items: [p(1)], total: 1 }),
      ]);
    });

    it('reports failures instead of erroring the stream', () => {
      setup();
      search.mockReturnValue(throwError(() => new Error('down')));
      const out = collect(effects.fetch$);
      actions$.next(ProductsActions.searchRequested({ query: 'a', page: 0 }));
      expect(out).toEqual([ProductsActions.searchFailed({ error: 'down' })]);
      // stream is still alive
      search.mockReturnValue(of({ items: [], total: 0 }));
      actions$.next(ProductsActions.searchRequested({ query: 'b', page: 0 }));
      expect(out).toHaveLength(2);
    });

    it('cancels an in-flight request when a newer one arrives (switchMap)', () => {
      setup();
      const first = new Subject<{ items: Product[]; total: number }>();
      search.mockReturnValueOnce(first);
      const out = collect(effects.fetch$);
      actions$.next(ProductsActions.searchRequested({ query: 'a', page: 0 }));
      actions$.next(ProductsActions.searchRequested({ query: 'ab', page: 0 }));
      first.next({ items: [p(9)], total: 1 });
      expect(out).toEqual([
        ProductsActions.searchSucceeded({ query: 'ab', page: 0, items: [p(1)], total: 1 }),
      ]);
    });
  });

  describe('loadNextPage', () => {
    const loaded: ProductsState = {
      ...initialProductsState,
      query: 'q',
      items: [p(1)],
      total: 3,
      pagesLoaded: 1,
      loaded: true,
    };

    it('requests the next page when more is available', () => {
      setup(loaded);
      const out = collect(effects.loadNextPage$);
      actions$.next(ProductsActions.loadNextPage());
      expect(out).toEqual([ProductsActions.searchRequested({ query: 'q', page: 1 })]);
    });

    it('does nothing while a request is in flight', () => {
      setup({ ...loaded, loading: true });
      const out = collect(effects.loadNextPage$);
      actions$.next(ProductsActions.loadNextPage());
      expect(out).toEqual([]);
    });

    it('does nothing when everything is loaded', () => {
      setup({ ...loaded, total: 1 });
      const out = collect(effects.loadNextPage$);
      actions$.next(ProductsActions.loadNextPage());
      expect(out).toEqual([]);
    });
  });
});

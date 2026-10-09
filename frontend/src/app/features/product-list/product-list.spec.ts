import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { BehaviorSubject } from 'rxjs';
import { ProductsActions } from '../../store/products/products.actions';
import { initialProductsState, type ProductsState } from '../../store/products/products.reducer';
import { makeProduct, makeProducts } from '../../testing/product.factory';
import { ProductDialogService } from '../product-dialog/product-dialog.service';
import { ProductList, chunk, columnsFor, shouldLoadMore } from './product-list';

describe('chunk', () => {
  it('splits into rows of the given size, last row may be short', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('handles empty input and size < 1', () => {
    expect(chunk([], 3)).toEqual([]);
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe('columnsFor', () => {
  it.each([
    [{ '(min-width: 1200px)': true, '(min-width: 900px)': true, '(min-width: 600px)': true }, 4],
    [{ '(min-width: 1200px)': false, '(min-width: 900px)': true, '(min-width: 600px)': true }, 3],
    [{ '(min-width: 1200px)': false, '(min-width: 900px)': false, '(min-width: 600px)': true }, 2],
    [{ '(min-width: 1200px)': false, '(min-width: 900px)': false, '(min-width: 600px)': false }, 1],
  ])('maps %j to %i columns (mobile-first)', (breakpoints, cols) => {
    expect(columnsFor(breakpoints)).toBe(cols);
  });
});

describe('shouldLoadMore', () => {
  it('is true when the rendered range reaches the load threshold from the end', () => {
    expect(shouldLoadMore(8, 10, 3)).toBe(true);
    expect(shouldLoadMore(10, 10, 3)).toBe(true);
  });
  it('is false while far from the end', () => {
    expect(shouldLoadMore(5, 10, 3)).toBe(false);
  });
  it('is false with no rows', () => {
    expect(shouldLoadMore(0, 0, 3)).toBe(false);
  });
});

describe('ProductList', () => {
  let fixture: ComponentFixture<ProductList>;
  let store: MockStore;
  let dispatch: ReturnType<typeof vi.spyOn>;
  let breakpoints$: BehaviorSubject<BreakpointState>;
  const openDialog = vi.fn();

  const state = (over: Partial<ProductsState>): ProductsState => ({
    ...initialProductsState,
    ...over,
  });
  const el = () => fixture.nativeElement as HTMLElement;
  const bp = (min600: boolean, min900 = false, min1200 = false): BreakpointState => ({
    matches: min600,
    breakpoints: {
      '(min-width: 600px)': min600,
      '(min-width: 900px)': min900,
      '(min-width: 1200px)': min1200,
    },
  });

  const create = async (products: ProductsState, viewport: BreakpointState = bp(false)) => {
    breakpoints$ = new BehaviorSubject(viewport);
    TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [
        provideMockStore({ initialState: { products } }),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => breakpoints$, isMatched: () => false },
        },
        { provide: ProductDialogService, useValue: { open: openDialog } },
      ],
    });
    store = TestBed.inject(MockStore);
    dispatch = vi.spyOn(store, 'dispatch');
    fixture = TestBed.createComponent(ProductList);
    await fixture.whenStable();
  };

  beforeEach(() => openDialog.mockClear());

  it('shows skeletons during the first load', async () => {
    await create(state({ loading: true }));
    expect(el().querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(el().querySelector('[role="status"]')?.textContent).toContain('Loading');
  });

  it('shows an empty state naming the query when nothing matches', async () => {
    await create(state({ query: 'zzz', loaded: true, items: [], total: 0 }));
    expect(el().querySelector('.empty')?.textContent).toContain('zzz');
  });

  it('shows an error state with a retry that re-requests the failed page', async () => {
    await create(
      state({
        query: 'abc',
        error: 'down',
        items: makeProducts(2),
        total: 5,
        pagesLoaded: 1,
        loaded: true,
      }),
    );
    expect(el().querySelector('.error')?.textContent).toContain('down');
    el().querySelector<HTMLButtonElement>('.error button')!.click();
    expect(dispatch).toHaveBeenCalledWith(
      ProductsActions.searchRequested({ query: 'abc', page: 1 }),
    );
  });

  it('renders products in a virtual scroller (windowed, not all at once)', async () => {
    await create(state({ items: makeProducts(200), total: 400, pagesLoaded: 9, loaded: true }));
    const viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport));
    expect(viewport).not.toBeNull();
    expect(el().querySelectorAll('app-product-card').length).toBeLessThan(200);
  });

  it('exposes the result count for assistive tech', async () => {
    await create(
      state({ query: 'lamp', items: makeProducts(3), total: 3, pagesLoaded: 1, loaded: true }),
    );
    expect(el().querySelector('[aria-live]')?.textContent).toContain('3');
  });

  it('opens the product dialog when a card is selected', async () => {
    await create(state({ items: [makeProduct(1)], total: 1, pagesLoaded: 1, loaded: true }));
    fixture.componentInstance.open(makeProduct(1));
    expect(openDialog).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  describe('batch loading', () => {
    const loaded = state({
      query: 'q',
      items: makeProducts(24),
      total: 100,
      pagesLoaded: 1,
      loaded: true,
    });

    const scrollTo = async (end: number) => {
      const viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport))
        .componentInstance as CdkVirtualScrollViewport;
      vi.spyOn(viewport, 'getRenderedRange').mockReturnValue({ start: 0, end });
      fixture.componentInstance.onScrolled();
    };

    it('requests the next batch when scrolled near the end', async () => {
      await create(loaded, bp(false)); // 1 column → 24 rows
      await scrollTo(23);
      expect(dispatch).toHaveBeenCalledWith(ProductsActions.loadNextPage());
    });

    it('does not request while far from the end', async () => {
      await create(loaded, bp(false));
      await scrollTo(3);
      expect(dispatch).not.toHaveBeenCalledWith(ProductsActions.loadNextPage());
    });

    it('lays out more cards per row on wider screens (fewer rows to scroll)', async () => {
      await create(loaded, bp(true, true, true)); // 4 columns
      expect(fixture.componentInstance.rows()).toHaveLength(6);
      expect(fixture.componentInstance.rows()[0]).toHaveLength(4);
    });

    it('re-flows rows when the viewport changes', async () => {
      await create(loaded, bp(false));
      expect(fixture.componentInstance.rows()).toHaveLength(24);
      breakpoints$.next(bp(true));
      await fixture.whenStable();
      expect(fixture.componentInstance.rows()).toHaveLength(12);
    });

    it('shows a loading-more indicator while the next batch is fetching', async () => {
      await create({ ...loaded, loading: true });
      expect(el().querySelector('.loading-more')).not.toBeNull();
    });

    it('shows an end-of-results note when everything is loaded', async () => {
      await create(
        state({ query: 'q', items: makeProducts(5), total: 5, pagesLoaded: 1, loaded: true }),
      );
      expect(el().querySelector('.end')).not.toBeNull();
    });
  });
});

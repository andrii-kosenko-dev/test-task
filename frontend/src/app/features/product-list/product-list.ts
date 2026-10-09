import { BreakpointObserver } from '@angular/cdk/layout';
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
  CdkVirtualScrollableWindow,
} from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import type { Product } from '../../core/models/product.model';
import { ProductsActions } from '../../store/products/products.actions';
import { productsFeature } from '../../store/products/products.reducer';
import { ProductCard } from '../product-card/product-card';
import { ProductDialogService } from '../product-dialog/product-dialog.service';

/** Mobile-first breakpoints: 1 column by default, more as the viewport grows. */
const BREAKPOINTS = ['(min-width: 600px)', '(min-width: 900px)', '(min-width: 1200px)'] as const;

/** Card height (336) + row gap (16). Must match the row styles. */
export const ROW_HEIGHT = 352;
const LOAD_THRESHOLD_ROWS = 4;
const SKELETON_COUNT = 8;

export function columnsFor(matches: Readonly<Record<string, boolean>>): number {
  if (matches['(min-width: 1200px)']) return 4;
  if (matches['(min-width: 900px)']) return 3;
  if (matches['(min-width: 600px)']) return 2;
  return 1;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const step = Math.max(1, size);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += step) rows.push(items.slice(i, i + step));
  return rows;
}

export function shouldLoadMore(renderedEnd: number, rowCount: number, threshold: number): boolean {
  return rowCount > 0 && renderedEnd >= rowCount - threshold;
}

@Component({
  selector: 'app-product-list',
  imports: [
    CdkVirtualScrollViewport,
    CdkVirtualScrollableWindow,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    MatButton,
    MatProgressSpinner,
    ProductCard,
  ],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductList {
  private readonly store = inject(Store);
  private readonly dialog = inject(ProductDialogService);

  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly skeletons = Array.from({ length: SKELETON_COUNT }, (_, i) => i);

  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  protected readonly items = this.store.selectSignal(productsFeature.selectItems);
  protected readonly total = this.store.selectSignal(productsFeature.selectTotal);
  protected readonly query = this.store.selectSignal(productsFeature.selectQuery);
  protected readonly loading = this.store.selectSignal(productsFeature.selectLoading);
  protected readonly loaded = this.store.selectSignal(productsFeature.selectLoaded);
  protected readonly error = this.store.selectSignal(productsFeature.selectError);
  protected readonly isEmpty = this.store.selectSignal(productsFeature.selectIsEmpty);
  protected readonly hasMore = this.store.selectSignal(productsFeature.selectHasMore);
  private readonly pagesLoaded = this.store.selectSignal(productsFeature.selectPagesLoaded);

  protected readonly columns = toSignal(
    inject(BreakpointObserver)
      .observe([...BREAKPOINTS])
      .pipe(map((state) => columnsFor(state.breakpoints))),
    { initialValue: 1 },
  );

  readonly rows = computed(() => chunk(this.items(), this.columns()));

  protected readonly showSkeleton = computed(() => this.loading() && this.items().length === 0);
  protected readonly summary = computed(() => {
    if (this.showSkeleton()) return 'Loading products…';
    if (!this.loaded()) return '';
    const q = this.query();
    const noun = this.total() === 1 ? 'product' : 'products';
    return `${this.total()} ${noun}${q ? ` for “${q}”` : ''}`;
  });

  protected trackRow = (_: number, row: readonly Product[]): number => row[0].id;

  open(product: Product): void {
    this.dialog.open(product);
  }

  /** Called as the rendered window moves; pulls the next batch near the end. */
  onScrolled(): void {
    const viewport = this.viewport();
    if (!viewport) return;
    if (shouldLoadMore(viewport.getRenderedRange().end, this.rows().length, LOAD_THRESHOLD_ROWS)) {
      this.store.dispatch(ProductsActions.loadNextPage());
    }
  }

  protected retry(): void {
    this.store.dispatch(
      ProductsActions.searchRequested({ query: this.query(), page: this.pagesLoaded() }),
    );
  }
}

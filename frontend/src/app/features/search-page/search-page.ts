import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ProductsActions } from '../../store/products/products.actions';
import { ProductList } from '../product-list/product-list';
import { SearchBar } from '../search/search-bar';

@Component({
  selector: 'app-search-page',
  imports: [SearchBar, ProductList],
  template: `
    <section class="search"><app-search-bar /></section>
    <app-product-list />
  `,
  styles: `
    .search {
      position: sticky;
      top: 3.5rem;
      z-index: 5;
      padding-block: 0.75rem 0.25rem;
      background: var(--mat-sys-background);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage {
  constructor() {
    // Initial listing: a blank query lists every product.
    inject(Store).dispatch(ProductsActions.queryChanged({ query: '' }));
  }
}

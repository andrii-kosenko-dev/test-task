import type { Observable } from 'rxjs';
import type { ProductPage } from '../models/product.model';

/**
 * Contract for the product data source.
 * The fixture implementation is a stand-in until the backend exists; swap it in app.config.
 */
export abstract class ProductsApi {
  /** Zero-based paged search. A blank query lists everything. */
  abstract search(query: string, page: number, pageSize: number): Observable<ProductPage>;

  /** All product titles, used to build the typeahead term index. */
  abstract titles(): Observable<readonly string[]>;
}

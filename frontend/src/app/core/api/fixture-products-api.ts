import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, defer, delay, map, shareReplay } from 'rxjs';
import type { Product, ProductPage } from '../models/product.model';
import { rankProducts } from '../search/ranking';
import { ProductsApi } from './products-api';

export const PRODUCTS_API_LATENCY_MS = new InjectionToken<number>('PRODUCTS_API_LATENCY_MS', {
  providedIn: 'root',
  factory: () => 300,
});

@Injectable()
export class FixtureProductsApi extends ProductsApi {
  private readonly latency = inject(PRODUCTS_API_LATENCY_MS);

  // Lazy so the fixture ships as its own chunk instead of inflating the initial bundle.
  private readonly products$ = defer(() => import('../data/products.fixture.json')).pipe(
    map((module) => module.default as unknown as readonly Product[]),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  search(query: string, page: number, pageSize: number): Observable<ProductPage> {
    return this.products$.pipe(
      map((products) => {
        const ranked = rankProducts(products, query);
        const start = page * pageSize;
        return { items: ranked.slice(start, start + pageSize), total: ranked.length };
      }),
      delay(this.latency),
    );
  }

  titles(): Observable<readonly string[]> {
    return this.products$.pipe(map((products) => products.map((p) => p.title)));
  }
}

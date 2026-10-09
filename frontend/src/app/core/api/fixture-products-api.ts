import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import fixture from '../data/products.fixture.json';
import type { Product, ProductPage } from '../models/product.model';
import { rankProducts } from '../search/ranking';
import { ProductsApi } from './products-api';

export const PRODUCTS_API_LATENCY_MS = new InjectionToken<number>('PRODUCTS_API_LATENCY_MS', {
  providedIn: 'root',
  factory: () => 300,
});

const PRODUCTS = fixture as unknown as readonly Product[];

@Injectable()
export class FixtureProductsApi extends ProductsApi {
  private readonly latency = inject(PRODUCTS_API_LATENCY_MS);

  search(query: string, page: number, pageSize: number): Observable<ProductPage> {
    const ranked = rankProducts(PRODUCTS, query);
    const start = page * pageSize;
    return of({ items: ranked.slice(start, start + pageSize), total: ranked.length }).pipe(
      delay(this.latency),
    );
  }

  titles(): Observable<readonly string[]> {
    return of(PRODUCTS.map((p) => p.title));
  }
}

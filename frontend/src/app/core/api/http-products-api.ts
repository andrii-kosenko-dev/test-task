import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import type { ProductPage } from '../models/product.model';
import { ProductsApi } from './products-api';

/** Where the backend lives. `/api` is proxied to the ingest service (nginx in Docker, proxy.conf.json in dev). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});

interface ProductPageResponse extends ProductPage {
  readonly page: number;
  readonly pageSize: number;
}

@Injectable()
export class HttpProductsApi extends ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // Titles never change within a session; cache them, but let a failed load be retried.
  private readonly titles$ = this.http
    .get<string[]>(`${this.baseUrl}/products/titles`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  search(query: string, page: number, pageSize: number): Observable<ProductPage> {
    const q = query.trim();
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (q) params = params.set('q', q);
    return this.http
      .get<ProductPageResponse>(`${this.baseUrl}/products`, { params })
      .pipe(map(({ items, total }) => ({ items, total })));
  }

  titles(): Observable<readonly string[]> {
    return this.titles$;
  }
}

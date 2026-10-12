import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, HttpProductsApi } from './http-products-api';
import { ProductsApi } from './products-api';

describe('HttpProductsApi', () => {
  let api: ProductsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProductsApi, useClass: HttpProductsApi },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    api = TestBed.inject(ProductsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests a page with the query, page and page size', async () => {
    const result = firstValueFrom(api.search('red lip', 2, 24));
    const req = http.expectOne((r) => r.url === '/api/products');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('red lip');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('24');
    req.flush({ items: [{ id: 1 }], total: 40, page: 2, pageSize: 24 });
    expect(await result).toEqual({ items: [{ id: 1 }], total: 40 });
  });

  it('omits the q param for a blank query', async () => {
    const result = firstValueFrom(api.search('   ', 0, 10));
    const req = http.expectOne((r) => r.url === '/api/products');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ items: [], total: 0, page: 0, pageSize: 10 });
    await result;
  });

  it('loads titles once and shares the result', async () => {
    const first = firstValueFrom(api.titles());
    http.expectOne('/api/products/titles').flush(['A', 'B']);
    expect(await first).toEqual(['A', 'B']);
    expect(await firstValueFrom(api.titles())).toEqual(['A', 'B']);
    http.expectNone('/api/products/titles');
  });

  it('propagates HTTP errors so the store can show its error state', async () => {
    const result = firstValueFrom(api.search('x', 0, 10));
    http
      .expectOne((r) => r.url === '/api/products')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(result).rejects.toMatchObject({ status: 500 });
  });

  it('retries titles after a failure instead of caching the error', async () => {
    const failed = firstValueFrom(api.titles());
    http.expectOne('/api/products/titles').flush('x', { status: 503, statusText: 'Unavailable' });
    await expect(failed).rejects.toBeDefined();
    const retry = firstValueFrom(api.titles());
    http.expectOne('/api/products/titles').flush(['A']);
    expect(await retry).toEqual(['A']);
  });
});

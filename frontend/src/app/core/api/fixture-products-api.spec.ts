import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FixtureProductsApi, PRODUCTS_API_LATENCY_MS } from './fixture-products-api';
import { ProductsApi } from './products-api';

describe('FixtureProductsApi', () => {
  let api: ProductsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ProductsApi, useClass: FixtureProductsApi },
        { provide: PRODUCTS_API_LATENCY_MS, useValue: 0 },
      ],
    });
    api = TestBed.inject(ProductsApi);
  });

  it('returns the first page of everything for a blank query', async () => {
    const page = await firstValueFrom(api.search('', 0, 20));
    expect(page.items).toHaveLength(20);
    expect(page.total).toBeGreaterThanOrEqual(100);
  });

  it('pages consecutively without overlap', async () => {
    const a = await firstValueFrom(api.search('', 0, 10));
    const b = await firstValueFrom(api.search('', 1, 10));
    const ids = new Set(a.items.map((p) => p.id));
    expect(b.items.every((p) => !ids.has(p.id))).toBe(true);
  });

  it('returns a short last page', async () => {
    const { total } = await firstValueFrom(api.search('', 0, 1));
    const size = 30;
    const lastIndex = Math.floor((total - 1) / size);
    const last = await firstValueFrom(api.search('', lastIndex, size));
    expect(last.items.length).toBe(total - lastIndex * size);
  });

  it('returns an empty page beyond the end', async () => {
    const page = await firstValueFrom(api.search('', 9999, 20));
    expect(page.items).toEqual([]);
    expect(page.total).toBeGreaterThan(0);
  });

  it('filters and ranks by the query', async () => {
    const page = await firstValueFrom(api.search('mascara', 0, 50));
    expect(page.total).toBe(page.items.length);
    expect(page.total).toBeGreaterThan(0);
    expect(page.items[0].title.toLowerCase()).toContain('mascara');
  });

  it('returns no items and total 0 when nothing matches', async () => {
    const page = await firstValueFrom(api.search('zzzzqqq', 0, 20));
    expect(page).toEqual({ items: [], total: 0 });
  });

  it('exposes every product title for typeahead indexing', async () => {
    const titles = await firstValueFrom(api.titles());
    expect(titles.length).toBeGreaterThanOrEqual(100);
    expect(titles.every((t) => t.length > 0)).toBe(true);
  });

  describe('simulated latency', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('delays the response by the configured latency', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: ProductsApi, useClass: FixtureProductsApi },
          { provide: PRODUCTS_API_LATENCY_MS, useValue: 250 },
        ],
      });
      const delayed = TestBed.inject(ProductsApi);
      let done = false;
      delayed.search('', 0, 5).subscribe(() => (done = true));

      await vi.advanceTimersByTimeAsync(249);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(done).toBe(true);
    });
  });
});

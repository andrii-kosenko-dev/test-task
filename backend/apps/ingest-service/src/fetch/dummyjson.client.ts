import { Product } from '../products/product.model';
import { parseProductRow } from '../products/product-row';

export interface DummyJsonOptions {
  readonly baseUrl: string;
  readonly pageSize: number;
  readonly retries: number;
  readonly retryDelayMs?: number;
  readonly fetchFn?: typeof fetch;
}

export interface FetchResult {
  readonly products: Product[];
  /** Rows the API returned that failed validation. */
  readonly skipped: number;
}

interface ProductsResponse {
  readonly products?: unknown[];
  readonly total?: number;
}

/** Downloads the whole DummyJSON catalogue page by page, retrying transient failures. */
export class DummyJsonClient {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: DummyJsonOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async fetchAllProducts(): Promise<FetchResult> {
    const products: Product[] = [];
    let skipped = 0;
    let skip = 0;
    let total = Number.POSITIVE_INFINITY;

    while (skip < total) {
      const page = await this.fetchPage(skip);
      const rows = page.products ?? [];
      if (rows.length === 0) break;
      total = page.total ?? skip + rows.length;
      for (const row of rows) {
        const parsed = parseProductRow(row);
        if (parsed.ok) products.push(parsed.product);
        else skipped++;
      }
      skip += rows.length;
    }
    return { products, skipped };
  }

  private async fetchPage(skip: number): Promise<ProductsResponse> {
    const url = `${this.options.baseUrl}/products?limit=${this.options.pageSize}&skip=${skip}`;
    let lastError: Error = new Error('unreachable');
    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      if (attempt > 0) await this.sleep((this.options.retryDelayMs ?? 500) * attempt);
      try {
        const response = await this.fetchFn(url);
        if (response.ok) return (await response.json()) as ProductsResponse;
        lastError = new Error(`DummyJSON responded ${response.status} for ${url}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { parseProductRow } from './product-row';
import type { Product } from './product.model';
import { ProductsRepository } from './products.repository';

export const IMPORT_BATCH_SIZE = Symbol('IMPORT_BATCH_SIZE');
const MAX_REPORTED_INVALID = 100;

export interface InvalidRow {
  /** 1-based position in the data rows of the source. */
  readonly row: number;
  readonly errors: readonly string[];
}

export interface ImportResult {
  readonly received: number;
  readonly inserted: number;
  readonly updated: number;
  readonly invalidCount: number;
  /** First `MAX_REPORTED_INVALID` invalid rows. */
  readonly invalid: readonly InvalidRow[];
}

/** Validates a stream of untrusted rows and upserts the good ones in unordered batches. */
@Injectable()
export class ImportService {
  constructor(
    private readonly repository: ProductsRepository,
    @Inject(IMPORT_BATCH_SIZE) private readonly batchSize: number = 500,
  ) {}

  async import(source: AsyncIterable<unknown>): Promise<ImportResult> {
    let received = 0;
    let inserted = 0;
    let updated = 0;
    let invalidCount = 0;
    const invalid: InvalidRow[] = [];
    let batch: Product[] = [];

    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      const outcome = await this.repository.upsertMany(batch);
      inserted += outcome.inserted;
      updated += outcome.updated;
      batch = [];
    };

    for await (const raw of source) {
      received++;
      const parsed = parseProductRow(raw);
      if (parsed.ok) {
        batch.push(parsed.product);
        if (batch.length >= this.batchSize) await flush();
      } else {
        invalidCount++;
        if (invalid.length < MAX_REPORTED_INVALID) invalid.push({ row: received, errors: parsed.errors });
      }
    }
    await flush();

    return { received, inserted, updated, invalidCount, invalid };
  }
}

import { ImportService } from './import.service';
import type { Product } from './product.model';

const row = (id: number) => ({ id, title: `T${id}`, description: '', category: 'c', price: 1, thumbnail: '', images: [] });

async function* rows(items: unknown[]): AsyncGenerator<unknown> {
  for (const i of items) yield i;
}

function setup(batchSize = 2) {
  const upsertMany = jest.fn(async (batch: readonly Product[]) => ({ inserted: batch.length, updated: 0 }));
  const service = new ImportService({ upsertMany } as never, batchSize);
  return { service, upsertMany };
}

describe('ImportService', () => {
  it('upserts valid rows in batches and sums the outcome', async () => {
    const { service, upsertMany } = setup(2);
    const result = await service.import(rows([row(1), row(2), row(3), row(4), row(5)]));
    expect(upsertMany.mock.calls.map((c) => c[0].length)).toEqual([2, 2, 1]);
    expect(result).toEqual({ received: 5, inserted: 5, updated: 0, invalidCount: 0, invalid: [] });
  });

  it('keeps going past invalid rows and reports their 1-based position and reasons', async () => {
    const { service, upsertMany } = setup(10);
    const result = await service.import(rows([row(1), { id: 'x' }, 'junk', row(2)]));
    expect(upsertMany).toHaveBeenCalledTimes(1);
    expect(result.received).toBe(4);
    expect(result.inserted).toBe(2);
    expect(result.invalid.map((i) => i.row)).toEqual([2, 3]);
    expect(result.invalid[0]?.errors.length).toBeGreaterThan(0);
  });

  it('caps the invalid sample but still counts every invalid row', async () => {
    const { service } = setup(10);
    const result = await service.import(rows(Array.from({ length: 250 }, () => ({}))));
    expect(result.invalid).toHaveLength(100);
    expect(result.invalidCount).toBe(250);
  });

  it('handles an empty source', async () => {
    const { service, upsertMany } = setup();
    expect(await service.import(rows([]))).toEqual({ received: 0, inserted: 0, updated: 0, invalidCount: 0, invalid: [] });
    expect(upsertMany).not.toHaveBeenCalled();
  });

  it('propagates storage failures', async () => {
    const service = new ImportService({ upsertMany: jest.fn().mockRejectedValue(new Error('db')) } as never, 2);
    await expect(service.import(rows([row(1)]))).rejects.toThrow('db');
  });
});

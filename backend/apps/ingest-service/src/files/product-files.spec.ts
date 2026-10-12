import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Product } from '../products/product.model';
import { detectFormat, readProductRows, writeProductsJson, writeProductsXlsx } from './product-files';

const products: Product[] = [
  { id: 1, title: 'A', description: 'desc', category: 'beauty', brand: 'B', price: 1.5, thumbnail: 't1', images: ['i1', 'i2'] },
  { id: 2, title: 'C', description: '', category: 'tools', price: 20, thumbnail: 't2', images: [] },
];

async function collect(iter: AsyncIterable<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const row of iter) out.push(row);
  return out;
}

describe('product files', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'pf-')); });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('detects format from the extension', () => {
    expect(detectFormat('x.JSON')).toBe('json');
    expect(detectFormat('x.xlsx')).toBe('xlsx');
    expect(() => detectFormat('x.csv')).toThrow(/Unsupported/);
  });

  it('round-trips JSON', async () => {
    const file = join(dir, 'p.json');
    await writeProductsJson(file, products);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(products);
    expect(await collect(readProductRows(file, 'json'))).toEqual(products);
  });

  it('reads a DummyJSON-style { products: [] } envelope', async () => {
    const file = join(dir, 'env.json');
    await writeFile(file, JSON.stringify({ products, total: 2, skip: 0, limit: 2 }));
    expect(await collect(readProductRows(file, 'json'))).toEqual(products);
  });

  it('round-trips XLSX with images pipe-joined and a missing brand left blank', async () => {
    const file = join(dir, 'p.xlsx');
    await writeProductsXlsx(file, products);
    const rows = (await collect(readProductRows(file, 'xlsx'))) as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 1, title: 'A', brand: 'B', price: 1.5, images: 'i1|i2' });
    expect(rows[1]?.['brand'] ?? '').toBe('');
  });

  it('rejects malformed JSON while reading', async () => {
    const file = join(dir, 'bad.json');
    await writeFile(file, '[{"id":1},');
    await expect(collect(readProductRows(file, 'json'))).rejects.toThrow();
  });
});

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Product } from '../products/product.model';
import { ExportService } from './export.service';

const products: Product[] = [
  { id: 1, title: 'A', description: '', category: 'c', price: 1, thumbnail: '', images: [] },
];

describe('ExportService', () => {
  let dir: string;
  let service: ExportService;
  const client = { fetchAllProducts: jest.fn() };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'exp-'));
    client.fetchAllProducts.mockResolvedValue({ products, skipped: 2 });
    service = new ExportService(client as never, dir, () => new Date('2026-01-02T03:04:05.678Z'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('fetches once and writes both a JSON and an XLSX file', async () => {
    const result = await service.fetchAndExport();
    expect(client.fetchAllProducts).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ count: 1, skipped: 2 });
    expect(result.files.map((f) => f.name)).toEqual([
      'products-20260102T030405678Z.json',
      'products-20260102T030405678Z.xlsx',
    ]);
    expect(JSON.parse(await readFile(join(dir, result.files[0]!.name), 'utf8'))).toEqual(products);
    expect(result.files.every((f) => f.bytes > 0)).toBe(true);
  });

  it('lists exports newest first and ignores unrelated files', async () => {
    await writeFile(join(dir, 'products-20250101T000000000Z.json'), '[]');
    await writeFile(join(dir, 'products-20260101T000000000Z.xlsx'), 'x');
    await writeFile(join(dir, 'notes.txt'), 'x');
    const list = await service.list();
    expect(list.map((f) => f.name)).toEqual([
      'products-20260101T000000000Z.xlsx',
      'products-20250101T000000000Z.json',
    ]);
  });

  it('lists nothing when the directory does not exist yet', async () => {
    const s = new ExportService(client as never, join(dir, 'missing'));
    expect(await s.list()).toEqual([]);
  });

  it('resolves only well-formed export names (no path traversal)', async () => {
    expect(service.resolve('products-20260101T000000000Z.json')).toBe(join(dir, 'products-20260101T000000000Z.json'));
    expect(() => service.resolve('../etc/passwd')).toThrow(/Invalid/);
    expect(() => service.resolve('products-1.json/../../x')).toThrow(/Invalid/);
    expect(() => service.resolve('x.json')).toThrow(/Invalid/);
  });
});

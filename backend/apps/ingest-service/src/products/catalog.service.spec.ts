import { CatalogService } from './catalog.service';

const exportResult = { count: 2, skipped: 0, files: [{ name: 'products-1.json', format: 'json', bytes: 5 }] };
const importResult = { received: 2, inserted: 2, updated: 0, invalidCount: 0, invalid: [] };

function setup(count = 0) {
  const exporter = { fetchAndExport: jest.fn().mockResolvedValue(exportResult), resolve: jest.fn((n: string) => `/data/${n}`) };
  const importer = { import: jest.fn().mockResolvedValue(importResult) };
  const repo = { count: jest.fn().mockResolvedValue(count) };
  const readRows = jest.fn().mockReturnValue('rows');
  return { svc: new CatalogService(exporter as never, importer as never, repo as never, readRows), exporter, importer, repo, readRows };
}

describe('CatalogService', () => {
  it('exports only when import is not requested', async () => {
    const { svc, importer } = setup();
    expect(await svc.syncFromPublicApi(false)).toEqual({ export: exportResult, import: null });
    expect(importer.import).not.toHaveBeenCalled();
  });

  it('imports the freshly exported JSON file when requested', async () => {
    const { svc, importer, readRows } = setup();
    const res = await svc.syncFromPublicApi(true);
    expect(readRows).toHaveBeenCalledWith('/data/products-1.json', 'json');
    expect(importer.import).toHaveBeenCalledWith('rows');
    expect(res.import).toEqual(importResult);
  });

  it('seeds only an empty collection', async () => {
    const empty = setup(0);
    expect(await empty.svc.seedIfEmpty()).toBe(true);
    expect(empty.importer.import).toHaveBeenCalled();
    const full = setup(194);
    expect(await full.svc.seedIfEmpty()).toBe(false);
    expect(full.exporter.fetchAndExport).not.toHaveBeenCalled();
  });
});

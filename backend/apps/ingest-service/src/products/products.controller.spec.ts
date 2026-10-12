import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { ExportService } from '../fetch/export.service';
import { CatalogService } from './catalog.service';
import { ImportService } from './import.service';
import { ProductsController } from './products.controller';
import { ProductsRepository } from './products.repository';

describe('ProductsController (http)', () => {
  let app: INestApplication;
  let dir: string;
  const repo = { search: jest.fn(), titles: jest.fn(), findById: jest.fn() };
  const importer = { import: jest.fn() };
  const catalog = { syncFromPublicApi: jest.fn() };
  const exports_ = { list: jest.fn(), resolve: jest.fn() };

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ctl-'));
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsRepository, useValue: repo },
        { provide: ImportService, useValue: importer },
        { provide: CatalogService, useValue: catalog },
        { provide: ExportService, useValue: exports_ },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });
  beforeEach(() => jest.resetAllMocks());

  it('GET /products searches with normalized paging and echoes it', async () => {
    repo.search.mockResolvedValue({ items: [{ id: 1 }], total: 1 });
    const res = await request(app.getHttpServer()).get('/products?q=phone&page=2&pageSize=500').expect(200);
    expect(repo.search).toHaveBeenCalledWith('phone', 2, 100);
    expect(res.body).toEqual({ items: [{ id: 1 }], total: 1, page: 2, pageSize: 100 });
  });

  it('GET /products defaults to a blank query on page 0', async () => {
    repo.search.mockResolvedValue({ items: [], total: 0 });
    await request(app.getHttpServer()).get('/products').expect(200);
    expect(repo.search).toHaveBeenCalledWith('', 0, 24);
  });

  it('GET /products rejects a non-numeric page and unknown params', async () => {
    await request(app.getHttpServer()).get('/products?page=abc').expect(400);
    await request(app.getHttpServer()).get('/products?evil=1').expect(400);
  });

  it('GET /products/titles returns the title list', async () => {
    repo.titles.mockResolvedValue(['A', 'B']);
    const res = await request(app.getHttpServer()).get('/products/titles').expect(200);
    expect(res.body).toEqual(['A', 'B']);
  });

  it('GET /products/:id returns 404 when missing, 400 for a bad id', async () => {
    repo.findById.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/products/5').expect(404);
    await request(app.getHttpServer()).get('/products/abc').expect(400);
    repo.findById.mockResolvedValue({ id: 5 });
    await request(app.getHttpServer()).get('/products/5').expect(200, { id: 5 });
  });

  it('POST /products/fetch runs the sync and returns its summary', async () => {
    catalog.syncFromPublicApi.mockResolvedValue({ export: { count: 2, skipped: 0, files: [] }, import: null });
    const res = await request(app.getHttpServer()).post('/products/fetch').expect(201);
    expect(catalog.syncFromPublicApi).toHaveBeenCalledWith(false);
    expect(res.body.export.count).toBe(2);
    await request(app.getHttpServer()).post('/products/fetch?import=true').expect(201);
    expect(catalog.syncFromPublicApi).toHaveBeenLastCalledWith(true);
  });

  it('GET /products/exports lists saved files', async () => {
    exports_.list.mockResolvedValue([{ name: 'products-1.json', format: 'json', bytes: 3 }]);
    const res = await request(app.getHttpServer()).get('/products/exports').expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /products/exports/:name downloads, and maps a bad name to 400', async () => {
    const file = join(dir, 'products-20260101T000000000Z.json');
    await writeFile(file, '[]');
    exports_.resolve.mockReturnValue(file);
    await request(app.getHttpServer()).get('/products/exports/products-20260101T000000000Z.json').expect(200);
    exports_.resolve.mockImplementation(() => {
      throw new Error('Invalid export name');
    });
    await request(app.getHttpServer()).get('/products/exports/nope').expect(400);
  });

  it('POST /products/import parses an uploaded JSON file', async () => {
    importer.import.mockResolvedValue({ received: 1, inserted: 1, updated: 0, invalidCount: 0, invalid: [] });
    const res = await request(app.getHttpServer())
      .post('/products/import')
      .attach('file', Buffer.from('[{"id":1}]'), 'p.json')
      .expect(201);
    expect(importer.import).toHaveBeenCalledTimes(1);
    expect(res.body.inserted).toBe(1);
  });

  it('POST /products/import rejects missing files and unsupported types', async () => {
    await request(app.getHttpServer()).post('/products/import').expect(400);
    await request(app.getHttpServer()).post('/products/import').attach('file', Buffer.from('a,b'), 'p.csv').expect(400);
    expect(importer.import).not.toHaveBeenCalled();
  });
});

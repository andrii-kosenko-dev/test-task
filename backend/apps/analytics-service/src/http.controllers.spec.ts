import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LogsController } from './logs/logs.controller';
import { LogsRepository } from './logs/logs.repository';
import { ReportsController } from './reports/reports.controller';
import { ReportService } from './reports/report.service';

describe('analytics HTTP', () => {
  let app: INestApplication;
  const logs = { query: jest.fn() };
  const reports = { generate: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LogsController, ReportsController],
      providers: [
        { provide: LogsRepository, useValue: logs },
        { provide: ReportService, useValue: reports },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  describe('GET /logs', () => {
    it('passes filters and paging to the repository and returns ISO timestamps', async () => {
      logs.query.mockResolvedValue({
        items: [{ eventId: 'e1', type: 'products.viewed', service: 'ingest-service', timestamp: new Date('2026-01-01T00:00:00Z'), payload: { id: 1 } }],
        total: 41,
      });
      const res = await request(app.getHttpServer())
        .get('/logs?type=products.viewed&service=ingest-service&from=2026-01-01&to=2026-02-01&page=1&pageSize=20')
        .expect(200);
      expect(logs.query).toHaveBeenCalledWith(
        { type: 'products.viewed', service: 'ingest-service', from: new Date('2026-01-01'), to: new Date('2026-02-01') },
        1,
        20,
      );
      expect(res.body).toEqual({
        items: [{ id: 'e1', type: 'products.viewed', service: 'ingest-service', timestamp: '2026-01-01T00:00:00.000Z', payload: { id: 1 } }],
        total: 41,
        page: 1,
        pageSize: 20,
      });
    });

    it('defaults paging and clamps the page size', async () => {
      logs.query.mockResolvedValue({ items: [], total: 0 });
      await request(app.getHttpServer()).get('/logs?pageSize=9999').expect(200);
      expect(logs.query).toHaveBeenCalledWith({}, 0, 100);
    });

    it.each(['type=bogus', 'from=yesterday', 'page=-1', 'x=1'])('rejects invalid query %s', async (q) => {
      await request(app.getHttpServer()).get(`/logs?${q}`).expect(400);
    });

    it('rejects an inverted range', async () => {
      await request(app.getHttpServer()).get('/logs?from=2026-02-01&to=2026-01-01').expect(400);
    });
  });

  describe('GET /reports/pdf', () => {
    it('streams the PDF with download headers', async () => {
      reports.generate.mockResolvedValue({ data: Buffer.from('%PDF-1.4'), filename: 'r.pdf' });
      const res = await request(app.getHttpServer())
        .get('/reports/pdf?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z&bucketSeconds=3600')
        .buffer()
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('r.pdf');
      expect(reports.generate).toHaveBeenCalledWith({
        from: Date.parse('2026-01-01T00:00:00Z'),
        to: Date.parse('2026-01-02T00:00:00Z'),
        bucketMs: 3_600_000,
      });
    });

    it('works without parameters', async () => {
      reports.generate.mockResolvedValue({ data: Buffer.from('%PDF'), filename: 'r.pdf' });
      await request(app.getHttpServer()).get('/reports/pdf').expect(200);
      expect(reports.generate).toHaveBeenCalledWith({});
    });

    it('rejects bad parameters and an inverted range', async () => {
      await request(app.getHttpServer()).get('/reports/pdf?bucketSeconds=0').expect(400);
      await request(app.getHttpServer()).get('/reports/pdf?from=nope').expect(400);
      await request(app.getHttpServer()).get('/reports/pdf?from=2026-02-01&to=2026-01-01').expect(400);
    });

    it('answers 502 when the report renderer fails', async () => {
      reports.generate.mockRejectedValue(new Error('14 UNAVAILABLE'));
      await request(app.getHttpServer()).get('/reports/pdf').expect(502);
    });
  });
});

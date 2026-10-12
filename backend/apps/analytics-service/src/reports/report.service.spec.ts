import { of } from 'rxjs';
import { ReportService } from './report.service';

const series = [{ key: 'events:a', type: 'a', points: [{ timestamp: 1000, value: 2 }] }];

function setup() {
  const queryEvents = jest.fn().mockResolvedValue(series);
  const generate = jest.fn().mockReturnValue(of({ pdf: Buffer.from('%PDF-1.4'), filename: 'r.pdf' }));
  const svc = new ReportService({ queryEvents } as never, { getService: () => ({ generateReport: generate }) } as never, () => 10_000_000);
  svc.onModuleInit();
  return { svc, queryEvents, generate };
}

describe('ReportService', () => {
  it('queries the time series and renders through gRPC', async () => {
    const { svc, queryEvents, generate } = setup();
    const pdf = await svc.generate({ from: 1_000_000, to: 1_600_000, bucketMs: 60_000 });
    expect(queryEvents).toHaveBeenCalledWith({ from: 1_000_000, to: 1_600_000, bucketMs: 60_000 });
    expect(generate).toHaveBeenCalledWith({
      title: expect.stringContaining('Event activity'),
      fromMs: 1_000_000,
      toMs: 1_600_000,
      bucketMs: 60_000,
      series: [{ type: 'a', points: [{ timestampMs: 1000, value: 2 }] }],
    });
    expect(pdf.filename).toMatch(/\.pdf$/);
    expect(pdf.data.toString()).toBe('%PDF-1.4');
  });

  it('defaults to the last 24 hours with an automatic bucket', async () => {
    const { svc, queryEvents } = setup();
    await svc.generate({});
    const arg = queryEvents.mock.calls[0]![0];
    expect(arg.to).toBe(10_000_000);
    expect(arg.from).toBe(10_000_000 - 24 * 3600_000);
    expect(arg.bucketMs).toBe(30 * 60_000);
  });

  it('rejects an inverted range', async () => {
    await expect(setup().svc.generate({ from: 5, to: 1 })).rejects.toThrow(/from/);
  });
});

import { createEvent, EVENT_TYPES } from '@app/common';
import { TimeSeriesClient, TimeSeriesService } from './time-series.service';

function fakeClient(): jest.Mocked<TimeSeriesClient['ts']> & { client: TimeSeriesClient } {
  const ts = { add: jest.fn(), mRange: jest.fn() } as unknown as jest.Mocked<TimeSeriesClient['ts']>;
  return Object.assign(ts, { client: { ts } as TimeSeriesClient });
}

describe('TimeSeriesService', () => {
  it('records an event as a labelled sample of 1 on events:<type>', async () => {
    const f = fakeClient();
    f.add.mockResolvedValue(1);
    const svc = new TimeSeriesService(f.client);
    const event = createEvent(EVENT_TYPES.PRODUCTS_SEARCHED, 'ingest-service', {}, 1234);

    await svc.recordEvent(event);

    expect(f.add).toHaveBeenCalledWith('events:products.searched', 1234, 1, {
      LABELS: { kind: 'event', type: 'products.searched', service: 'ingest-service' },
      ON_DUPLICATE: 'SUM',
      RETENTION: expect.any(Number),
    });
  });

  it('queries all event series as sorted typed series with bucket aggregation', async () => {
    const f = fakeClient();
    f.mRange.mockResolvedValue({
      'events:products.viewed': [{ timestamp: 2000, value: 3 }],
      'events:products.searched': [
        { timestamp: 0, value: 1 },
        { timestamp: 1000, value: 2 },
      ],
    });
    const svc = new TimeSeriesService(f.client);

    const series = await svc.queryEvents({ from: 0, to: 5000, bucketMs: 1000 });

    expect(f.mRange).toHaveBeenCalledWith(0, 5000, 'kind=event', {
      AGGREGATION: { type: 'SUM', timeBucket: 1000 },
    });
    expect(series.map((s) => s.type)).toEqual(['products.searched', 'products.viewed']);
    expect(series[0]?.points).toEqual([
      { timestamp: 0, value: 1 },
      { timestamp: 1000, value: 2 },
    ]);
  });

  it('returns no series when redis has none', async () => {
    const f = fakeClient();
    f.mRange.mockResolvedValue({});
    expect(await new TimeSeriesService(f.client).queryEvents({ from: 0, to: 1, bucketMs: 1 })).toEqual([]);
  });

  it('rejects an invalid range or bucket', async () => {
    const svc = new TimeSeriesService(fakeClient().client);
    await expect(svc.queryEvents({ from: 10, to: 5, bucketMs: 1 })).rejects.toThrow(/range/);
    await expect(svc.queryEvents({ from: 0, to: 5, bucketMs: 0 })).rejects.toThrow(/bucket/);
  });
});

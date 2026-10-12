import { buildLogFilter, toLogDocument } from './log-filter';
import { createEvent, EVENT_TYPES } from '@app/common';

describe('buildLogFilter', () => {
  it('is empty without filters', () => expect(buildLogFilter({})).toEqual({}));

  it('filters by exact type and service', () => {
    expect(buildLogFilter({ type: 'products.viewed', service: 'ingest-service' })).toEqual({
      type: 'products.viewed',
      service: 'ingest-service',
    });
  });

  it('builds an inclusive from, exclusive to date range', () => {
    const f = buildLogFilter({ from: new Date('2026-01-01'), to: new Date('2026-01-02') });
    expect(f).toEqual({ timestamp: { $gte: new Date('2026-01-01'), $lt: new Date('2026-01-02') } });
  });

  it('supports an open-ended range', () => {
    expect(buildLogFilter({ from: new Date('2026-01-01') })).toEqual({ timestamp: { $gte: new Date('2026-01-01') } });
  });
});

describe('toLogDocument', () => {
  it('maps an event to a stored log with a Date timestamp', () => {
    const e = createEvent(EVENT_TYPES.PRODUCTS_SEARCHED, 'ingest-service', { q: 'a' }, 1_700_000_000_000);
    expect(toLogDocument(e)).toEqual({
      eventId: e.id,
      type: 'products.searched',
      service: 'ingest-service',
      timestamp: new Date(1_700_000_000_000),
      payload: { q: 'a' },
    });
  });
});

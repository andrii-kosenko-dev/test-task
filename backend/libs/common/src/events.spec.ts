import { createEvent, EVENT_TYPES, isAppEvent, timeSeriesKey } from './events';

describe('events', () => {
  it('creates an event with id, service, type, payload and the given timestamp', () => {
    const e = createEvent(EVENT_TYPES.PRODUCTS_SEARCHED, 'ingest-service', { q: 'phone' }, 1_700_000_000_000);
    expect(e).toMatchObject({
      type: 'products.searched',
      service: 'ingest-service',
      payload: { q: 'phone' },
      timestamp: 1_700_000_000_000,
    });
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('defaults the timestamp to now', () => {
    const before = Date.now();
    const e = createEvent(EVENT_TYPES.PRODUCTS_FETCHED, 'ingest-service', {});
    expect(e.timestamp).toBeGreaterThanOrEqual(before);
  });

  it('builds the time series key for an event type', () => {
    expect(timeSeriesKey('products.searched')).toBe('events:products.searched');
  });

  it('recognises well-formed events only', () => {
    expect(isAppEvent(createEvent(EVENT_TYPES.PRODUCTS_IMPORTED, 's', {}))).toBe(true);
    expect(isAppEvent({ type: 'x' })).toBe(false);
    expect(isAppEvent(null)).toBe(false);
    expect(isAppEvent({ id: 'a', type: 'nope', service: 's', timestamp: 1, payload: {} })).toBe(false);
  });
});

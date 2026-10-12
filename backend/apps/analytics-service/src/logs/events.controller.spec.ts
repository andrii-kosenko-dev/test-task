import { createEvent, EVENT_TYPES } from '@app/common';
import { EventsController } from './events.controller';

describe('EventsController', () => {
  const insert = jest.fn().mockResolvedValue(undefined);
  const controller = new EventsController({ insert } as never);
  beforeEach(() => insert.mockClear());

  it('stores a valid event', async () => {
    const e = createEvent(EVENT_TYPES.PRODUCTS_VIEWED, 'ingest-service', { id: 1 });
    await controller.onEvent(e);
    expect(insert).toHaveBeenCalledWith(e);
  });

  it('drops malformed messages instead of crashing the subscriber', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    await controller.onEvent({ nope: true });
    expect(insert).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

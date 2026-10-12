import { of, throwError } from 'rxjs';
import { EVENT_PATTERN, EVENT_TYPES } from '@app/common';
import { EventPublisher } from './event-publisher';

function setup(overrides: { emit?: jest.Mock; record?: jest.Mock } = {}) {
  const emit = overrides.emit ?? jest.fn().mockReturnValue(of(undefined));
  const record = overrides.record ?? jest.fn().mockResolvedValue(undefined);
  const publisher = new EventPublisher({ emit } as never, { recordEvent: record } as never, 'ingest-service');
  return { publisher, emit, record };
}

describe('EventPublisher', () => {
  it('emits the event on the transporter and records it in the time series', async () => {
    const { publisher, emit, record } = setup();

    const event = await publisher.publish(EVENT_TYPES.PRODUCTS_SEARCHED, { q: 'x' });

    expect(event).toMatchObject({ type: 'products.searched', service: 'ingest-service', payload: { q: 'x' } });
    expect(emit).toHaveBeenCalledWith(EVENT_PATTERN, event);
    expect(record).toHaveBeenCalledWith(event);
  });

  it('never throws when the transporter or time series fail', async () => {
    const { publisher } = setup({
      emit: jest.fn().mockReturnValue(throwError(() => new Error('redis down'))),
      record: jest.fn().mockRejectedValue(new Error('ts down')),
    });
    const logs = jest.spyOn(console, 'warn').mockImplementation();

    await expect(publisher.publish(EVENT_TYPES.PRODUCTS_FETCHED, {})).resolves.toBeDefined();
    expect(logs).toHaveBeenCalledTimes(2);
    logs.mockRestore();
  });
});

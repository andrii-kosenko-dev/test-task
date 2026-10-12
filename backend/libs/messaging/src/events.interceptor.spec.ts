import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { EVENT_TYPES } from '@app/common';
import { EmitsEvent } from './emits-event.decorator';
import { EventsInterceptor } from './events.interceptor';

class Sample {
  @EmitsEvent(EVENT_TYPES.PRODUCTS_SEARCHED, ({ request, result }) => ({
    q: (request as { query: { q: string } }).query.q,
    total: (result as { total: number } | undefined)?.total,
  }))
  search(): void {}

  plain(): void {}
}

function ctx(handler: () => void, request: object = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Sample,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('EventsInterceptor', () => {
  const publish = jest.fn().mockResolvedValue(undefined);
  const interceptor = new EventsInterceptor(new Reflector(), { publish } as never);
  const sample = new Sample();
  beforeEach(() => publish.mockClear());

  it('publishes the described payload with outcome and duration after success, without altering the result', async () => {
    const next: CallHandler = { handle: () => of({ total: 3 }) };
    const result = await lastValueFrom(interceptor.intercept(ctx(sample.search, { query: { q: 'ph' } }), next));
    expect(result).toEqual({ total: 3 });
    expect(publish).toHaveBeenCalledWith('products.searched', {
      q: 'ph',
      total: 3,
      outcome: 'success',
      durationMs: expect.any(Number),
    });
  });

  it('publishes an error outcome and rethrows', async () => {
    const next: CallHandler = { handle: () => throwError(() => new Error('boom')) };
    await expect(lastValueFrom(interceptor.intercept(ctx(sample.search, { query: { q: 'x' } }), next))).rejects.toThrow('boom');
    expect(publish).toHaveBeenCalledWith('products.searched', {
      q: 'x',
      outcome: 'error',
      error: 'boom',
      durationMs: expect.any(Number),
    });
  });

  it('ignores handlers without the decorator', async () => {
    await lastValueFrom(interceptor.intercept(ctx(sample.plain), { handle: () => of(1) }));
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not fail the request when publishing rejects', async () => {
    publish.mockRejectedValueOnce(new Error('x'));
    await expect(
      lastValueFrom(interceptor.intercept(ctx(sample.search, { query: { q: 'a' } }), { handle: () => of({ total: 1 }) })),
    ).resolves.toEqual({ total: 1 });
  });
});

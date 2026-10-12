import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { EMITS_EVENT, EmitsEventMetadata } from './emits-event.decorator';
import { EventPublisher } from './event-publisher';

/** Turns every `@EmitsEvent` handler call into a published event (success or error). Fire and forget. */
@Injectable()
export class EventsInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly publisher: EventPublisher,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<EmitsEventMetadata | undefined>(EMITS_EVENT, context.getHandler());
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest<unknown>();
    const started = Date.now();
    const emit = (result: unknown, extra: Record<string, unknown>): void => {
      let described: Record<string, unknown> = {};
      try {
        described = { ...meta.describe?.({ request, result }) };
      } catch {
        // A faulty describer must not lose the event.
      }
      void this.publisher
        .publish(meta.type, { ...described, ...extra, durationMs: Date.now() - started })
        .catch(() => undefined);
    };

    return next.handle().pipe(
      tap({
        next: (result) => emit(result, { outcome: 'success' }),
        error: (err: unknown) =>
          emit(undefined, { outcome: 'error', error: err instanceof Error ? err.message : String(err) }),
      }),
    );
  }
}

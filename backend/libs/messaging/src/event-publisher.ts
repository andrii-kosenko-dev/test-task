import { Inject, Injectable } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { type AppEvent, createEvent, EVENT_PATTERN, type EventPayload, type EventType } from '@app/common';
import { TimeSeriesService } from '@app/redis';
import { EVENTS_CLIENT, SERVICE_NAME } from './messaging.constants';

/**
 * Publishes an API action to every sink: the Redis transporter (for subscribers such as
 * analytics) and RedisTimeSeries. Telemetry must never break the request, so failures are logged.
 */
@Injectable()
export class EventPublisher {

  constructor(
    @Inject(EVENTS_CLIENT) private readonly client: ClientProxy,
    private readonly timeSeries: TimeSeriesService,
    @Inject(SERVICE_NAME) private readonly service: string,
  ) {}

  async publish<P extends EventPayload>(type: EventType, payload: P): Promise<AppEvent<P>> {
    const event = createEvent(type, this.service, payload);
    const results = await Promise.allSettled([
      firstValueFrom(this.client.emit(EVENT_PATTERN, event), { defaultValue: undefined }),
      this.timeSeries.recordEvent(event),
    ]);
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const sink = i === 0 ? 'transporter' : 'time series';
        const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
        console.warn(`[events] ${sink} failed for ${type}: ${reason}`);
      }
    });
    return event;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { type AppEvent, timeSeriesKey } from '@app/common';
import { REDIS_CLIENT } from './redis.constants';

export interface SeriesPoint {
  readonly timestamp: number;
  readonly value: number;
}

export interface EventSeries {
  readonly key: string;
  readonly type: string;
  readonly points: readonly SeriesPoint[];
}

export interface EventQuery {
  readonly from: number;
  readonly to: number;
  readonly bucketMs: number;
}

/** The slice of the node-redis client (`@redis/time-series`) this service relies on. */
export interface TimeSeriesClient {
  readonly ts: {
    add(
      key: string,
      timestamp: number,
      value: number,
      options?: {
        LABELS?: Record<string, string>;
        ON_DUPLICATE?: 'SUM';
        RETENTION?: number;
      },
    ): Promise<number>;
    mRange(
      from: number,
      to: number,
      filter: string,
      options?: { AGGREGATION?: { type: 'SUM'; timeBucket: number } },
    ): Promise<Record<string, readonly SeriesPoint[]>>;
  };
}

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = timeSeriesKey('');

@Injectable()
export class TimeSeriesService {
  constructor(@Inject(REDIS_CLIENT) private readonly client: TimeSeriesClient) {}

  /** One sample of value 1 per event; same-millisecond events add up (ON_DUPLICATE SUM). */
  async recordEvent(event: AppEvent): Promise<void> {
    await this.client.ts.add(timeSeriesKey(event.type), event.timestamp, 1, {
      LABELS: { kind: 'event', type: event.type, service: event.service },
      ON_DUPLICATE: 'SUM',
      RETENTION: RETENTION_MS,
    });
  }

  async queryEvents({ from, to, bucketMs }: EventQuery): Promise<EventSeries[]> {
    if (!(from <= to)) throw new Error('Invalid range: from must not exceed to');
    if (!(bucketMs > 0)) throw new Error('Invalid bucket: bucketMs must be positive');

    const raw = await this.client.ts.mRange(from, to, 'kind=event', {
      AGGREGATION: { type: 'SUM', timeBucket: bucketMs },
    });

    return Object.entries(raw)
      .map(([key, points]) => ({
        key,
        type: key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : key,
        points: points.map(({ timestamp, value }) => ({ timestamp, value })),
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }
}

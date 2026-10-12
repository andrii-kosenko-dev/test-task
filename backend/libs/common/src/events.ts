import { randomUUID } from 'node:crypto';

export const EVENT_TYPES = {
  PRODUCTS_SEARCHED: 'products.searched',
  PRODUCTS_TITLES_LISTED: 'products.titles_listed',
  PRODUCTS_VIEWED: 'products.viewed',
  PRODUCTS_FETCHED: 'products.fetched',
  PRODUCTS_IMPORTED: 'products.imported',
  PRODUCTS_EXPORTS_LISTED: 'products.exports_listed',
  PRODUCTS_EXPORT_DOWNLOADED: 'products.export_downloaded',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const ALL_EVENT_TYPES: readonly EventType[] = Object.values(EVENT_TYPES);

/** Message pattern used on the Redis transporter. */
export const EVENT_PATTERN = 'app.event';

export type EventPayload = Readonly<Record<string, unknown>>;

export interface AppEvent<P extends EventPayload = EventPayload> {
  readonly id: string;
  readonly type: EventType;
  readonly service: string;
  /** Unix epoch in milliseconds. */
  readonly timestamp: number;
  readonly payload: P;
}

export function createEvent<P extends EventPayload>(
  type: EventType,
  service: string,
  payload: P,
  timestamp: number = Date.now(),
): AppEvent<P> {
  return { id: randomUUID(), type, service, timestamp, payload };
}

export function timeSeriesKey(type: EventType | string): string {
  return `events:${type}`;
}

export function isAppEvent(value: unknown): value is AppEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['service'] === 'string' &&
    typeof v['timestamp'] === 'number' &&
    typeof v['payload'] === 'object' &&
    v['payload'] !== null &&
    typeof v['type'] === 'string' &&
    (ALL_EVENT_TYPES as readonly string[]).includes(v['type'])
  );
}

import type { Filter } from 'mongodb';
import type { AppEvent, EventType } from '@app/common';
import type { LogDocument } from './log.model';

export interface LogFilter {
  readonly type?: EventType;
  readonly service?: string;
  /** Inclusive. */
  readonly from?: Date;
  /** Exclusive. */
  readonly to?: Date;
}

export function buildLogFilter({ type, service, from, to }: LogFilter): Filter<LogDocument> {
  return {
    ...(type ? { type } : {}),
    ...(service ? { service } : {}),
    ...(from || to ? { timestamp: { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) } } : {}),
  };
}

export function toLogDocument(event: AppEvent): LogDocument {
  return {
    eventId: event.id,
    type: event.type,
    service: event.service,
    timestamp: new Date(event.timestamp),
    payload: event.payload,
  };
}

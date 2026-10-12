import { SetMetadata } from '@nestjs/common';
import type { EventPayload, EventType } from '@app/common';

export const EMITS_EVENT = 'messaging:emits-event';

export interface EventContext {
  readonly request: unknown;
  /** Handler return value; undefined when the handler threw. */
  readonly result: unknown;
}

export interface EmitsEventMetadata {
  readonly type: EventType;
  readonly describe?: (context: EventContext) => EventPayload;
}

/** Marks a controller handler: the `EventsInterceptor` publishes `type` after it runs. */
export const EmitsEvent = (type: EventType, describe?: EmitsEventMetadata['describe']) =>
  SetMetadata<string, EmitsEventMetadata>(EMITS_EVENT, { type, describe });

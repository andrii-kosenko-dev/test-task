import type { EventPayload, EventType } from '@app/common';

export const LOGS_COLLECTION = 'logs';

export interface LogDocument {
  /** Id of the originating event; unique, makes redelivery harmless. */
  readonly eventId: string;
  readonly type: EventType;
  readonly service: string;
  readonly timestamp: Date;
  readonly payload: EventPayload;
}

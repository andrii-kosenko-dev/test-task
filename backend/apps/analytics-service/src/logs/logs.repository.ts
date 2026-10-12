import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Collection } from 'mongodb';
import { type AppEvent, type Page } from '@app/common';
import { collectionToken } from '@app/mongo';
import { buildLogFilter, LogFilter, toLogDocument } from './log-filter';
import { type LogDocument, LOGS_COLLECTION } from './log.model';

export const LOGS_COLLECTION_TOKEN = collectionToken(LOGS_COLLECTION);

@Injectable()
export class LogsRepository implements OnModuleInit {
  constructor(@Inject(LOGS_COLLECTION_TOKEN) private readonly logs: Collection<LogDocument>) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.logs.createIndex({ eventId: 1 }, { unique: true, name: 'event_id_unique' }),
      this.logs.createIndex({ timestamp: -1 }, { name: 'timestamp_desc' }),
      this.logs.createIndex({ type: 1, timestamp: -1 }, { name: 'type_timestamp' }),
      this.logs.createIndex({ service: 1, timestamp: -1 }, { name: 'service_timestamp' }),
    ]);
  }

  /** Idempotent: a redelivered event leaves the stored log untouched. */
  async insert(event: AppEvent): Promise<void> {
    const doc = toLogDocument(event);
    await this.logs.updateOne({ eventId: doc.eventId }, { $setOnInsert: doc }, { upsert: true });
  }

  async query(filter: LogFilter, page: number, pageSize: number): Promise<Page<LogDocument>> {
    const mongoFilter = buildLogFilter(filter);
    const [items, total] = await Promise.all([
      this.logs
        .find(mongoFilter, { projection: { _id: 0 } })
        .sort({ timestamp: -1, eventId: 1 })
        .skip(page * pageSize)
        .limit(pageSize)
        .toArray(),
      this.logs.countDocuments(mongoFilter),
    ]);
    return { items: items as LogDocument[], total };
  }
}

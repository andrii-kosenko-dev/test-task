import { DynamicModule, Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { Collection, Db, Document, MongoClient } from 'mongodb';

export const MONGO_CLIENT = Symbol('MONGO_CLIENT');
export const MONGO_DB = Symbol('MONGO_DB');

export interface MongoModuleOptions {
  readonly uri: string;
  readonly dbName: string;
}

@Injectable()
class MongoLifecycle implements OnApplicationShutdown {
  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}

@Global()
@Module({})
export class MongoModule {
  /** Connects the official `mongodb` driver once and exposes the client and the database. */
  static forRoot(options: MongoModuleOptions): DynamicModule {
    return {
      module: MongoModule,
      providers: [
        {
          provide: MONGO_CLIENT,
          useFactory: async (): Promise<MongoClient> => new MongoClient(options.uri).connect(),
        },
        { provide: MONGO_DB, inject: [MONGO_CLIENT], useFactory: (client: MongoClient): Db => client.db(options.dbName) },
        MongoLifecycle,
      ],
      exports: [MONGO_CLIENT, MONGO_DB],
    };
  }
}

/** Typed collection injection token factory: `@Inject(collectionToken('products'))`. */
export function collectionToken(name: string): string {
  return `MONGO_COLLECTION_${name}`;
}

/** Provider that exposes one typed collection. */
export function collectionProvider<T extends Document>(name: string) {
  return {
    provide: collectionToken(name),
    inject: [MONGO_DB],
    useFactory: (db: Db): Collection<T> => db.collection<T>(name),
  };
}

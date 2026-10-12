import { DynamicModule, Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { createClient } from 'redis';
import { REDIS_CLIENT } from './redis.constants';
import { TimeSeriesService } from './time-series.service';

export interface RedisModuleOptions {
  readonly url: string;
}

function buildClient(url: string) {
  return createClient({ url });
}

export type RedisClient = ReturnType<typeof buildClient>;

@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: RedisClient) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }
}

@Global()
@Module({})
export class RedisModule {
  /** Connects the official node-redis client once and exposes it plus the typed time series service. */
  static forRoot(options: RedisModuleOptions): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: async () => {
            const client = buildClient(options.url);
            client.on('error', (err) => console.error('[redis]', err.message));
            await client.connect();
            return client;
          },
        },
        RedisLifecycle,
        TimeSeriesService,
      ],
      exports: [REDIS_CLIENT, TimeSeriesService],
    };
  }
}

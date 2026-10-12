import { DynamicModule, Global, Module } from '@nestjs/common';
import { ClientsModule, RedisOptions, Transport } from '@nestjs/microservices';
import { EventPublisher } from './event-publisher';
import { EVENTS_CLIENT, SERVICE_NAME } from './messaging.constants';

export function redisTransport(url: string): RedisOptions {
  return { transport: Transport.REDIS, options: { host: new URL(url).hostname, port: Number(new URL(url).port || 6379) } };
}

export interface MessagingModuleOptions {
  readonly redisUrl: string;
  readonly service: string;
}

@Global()
@Module({})
export class MessagingModule {
  /** Registers the Redis transporter client and the `EventPublisher` that fans out to it and RedisTimeSeries. */
  static forRoot({ redisUrl, service }: MessagingModuleOptions): DynamicModule {
    return {
      module: MessagingModule,
      imports: [ClientsModule.register([{ name: EVENTS_CLIENT, ...redisTransport(redisUrl) }])],
      providers: [{ provide: SERVICE_NAME, useValue: service }, EventPublisher],
      exports: [EventPublisher],
    };
  }
}

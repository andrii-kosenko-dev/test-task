import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { envString } from '@app/common';
import { MongoModule, collectionProvider } from '@app/mongo';
import { RedisModule } from '@app/redis';
import { HealthController } from './health.controller';
import { EventsController } from './logs/events.controller';
import { LogDocument, LOGS_COLLECTION } from './logs/log.model';
import { LogsController } from './logs/logs.controller';
import { LogsRepository } from './logs/logs.repository';
import { CLOCK, REPORT_GRPC_CLIENT, ReportService } from './reports/report.service';
import { ReportsController } from './reports/reports.controller';

const env = process.env;

@Module({
  imports: [
    MongoModule.forRoot({
      uri: envString(env, 'MONGO_URI', 'mongodb://localhost:27017'),
      dbName: envString(env, 'MONGO_DB', 'analytics'),
    }),
    RedisModule.forRoot({ url: envString(env, 'REDIS_URL', 'redis://localhost:6379') }),
    ClientsModule.register([
      {
        name: REPORT_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: {
          package: 'report.v1',
          protoPath: envString(env, 'REPORT_PROTO_PATH', join(process.cwd(), 'proto/report.proto')),
          url: envString(env, 'REPORT_GRPC_URL', 'localhost:50051'),
          loader: { keepCase: false, longs: Number },
        },
      },
    ]),
  ],
  controllers: [EventsController, LogsController, ReportsController, HealthController],
  providers: [
    collectionProvider<LogDocument>(LOGS_COLLECTION),
    LogsRepository,
    ReportService,
    { provide: CLOCK, useValue: () => Date.now() },
  ],
})
export class AppModule {}

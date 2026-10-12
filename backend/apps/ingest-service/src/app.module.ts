import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { envInt, envString } from '@app/common';
import { MongoModule, collectionProvider } from '@app/mongo';
import { EventsInterceptor, MessagingModule } from '@app/messaging';
import { RedisModule } from '@app/redis';
import { DummyJsonClient } from './fetch/dummyjson.client';
import { EXPORT_DIR, ExportService, NOW } from './fetch/export.service';
import { readProductRows } from './files/product-files';
import { HealthController } from './health.controller';
import { CatalogService, READ_ROWS } from './products/catalog.service';
import { IMPORT_BATCH_SIZE, ImportService } from './products/import.service';
import { PRODUCTS_COLLECTION, ProductDocument } from './products/product.model';
import { ProductsController } from './products/products.controller';
import { ProductsRepository } from './products/products.repository';

export const SERVICE = 'ingest-service';
const env = process.env;
const redisUrl = envString(env, 'REDIS_URL', 'redis://localhost:6379');

@Module({
  imports: [
    MongoModule.forRoot({
      uri: envString(env, 'MONGO_URI', 'mongodb://localhost:27017'),
      dbName: envString(env, 'MONGO_DB', 'catalog'),
    }),
    RedisModule.forRoot({ url: redisUrl }),
    MessagingModule.forRoot({ redisUrl, service: SERVICE }),
  ],
  controllers: [ProductsController, HealthController],
  providers: [
    collectionProvider<ProductDocument>(PRODUCTS_COLLECTION),
    ProductsRepository,
    ImportService,
    ExportService,
    CatalogService,
    { provide: APP_INTERCEPTOR, useClass: EventsInterceptor },
    { provide: EXPORT_DIR, useValue: envString(env, 'EXPORT_DIR', './data/exports') },
    { provide: NOW, useValue: () => new Date() },
    { provide: READ_ROWS, useValue: readProductRows },
    { provide: IMPORT_BATCH_SIZE, useValue: envInt(env, 'IMPORT_BATCH_SIZE', 500) },
    {
      provide: DummyJsonClient,
      useValue: new DummyJsonClient({
        baseUrl: envString(env, 'DUMMYJSON_URL', 'https://dummyjson.com'),
        pageSize: envInt(env, 'DUMMYJSON_PAGE_SIZE', 100),
        retries: envInt(env, 'DUMMYJSON_RETRIES', 3),
      }),
    },
  ],
})
export class AppModule {}

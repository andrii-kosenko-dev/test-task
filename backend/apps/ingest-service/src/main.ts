import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { envInt, envString } from '@app/common';
import { AppModule } from './app.module';
import { CatalogService } from './products/catalog.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Ingest service')
      .setDescription('Fetches, imports and serves the product catalogue; publishes every action as an event.')
      .setVersion('1.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document);

  const port = envInt(process.env, 'PORT', 3001);
  await app.listen(port, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(`ingest-service on :${port}, Swagger at /docs`);

  if (envString(process.env, 'SEED_ON_START', 'true') === 'true') {
    // Do not block startup; a failing public API must not take the service down.
    app
      .get(CatalogService)
      .seedIfEmpty()
      .then((seeded) => logger.log(seeded ? 'Seeded catalogue from the public API' : 'Catalogue already populated'))
      .catch((err: Error) => logger.error(`Seeding failed: ${err.message}`));
  }
}

void bootstrap();

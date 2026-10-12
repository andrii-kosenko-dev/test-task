import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { envInt, envString } from '@app/common';
import { redisTransport } from '@app/messaging';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  // Subscribe to events published by the other services.
  app.connectMicroservice(redisTransport(envString(process.env, 'REDIS_URL', 'redis://localhost:6379')), {
    inheritAppConfig: true,
  });

  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Analytics service')
        .setDescription('Stores events as logs, serves log queries and PDF reports built from RedisTimeSeries.')
        .setVersion('1.0')
        .build(),
    ),
  );

  await app.startAllMicroservices();
  const port = envInt(process.env, 'PORT', 3002);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`analytics-service on :${port}, Swagger at /docs`);
}

void bootstrap();

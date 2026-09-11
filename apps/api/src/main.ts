import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { StructuredLogger } from './common/observability/structured-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.useLogger(app.get(StructuredLogger));
  configureApp(app, config);

  await app.listen(config.get<number>('PORT', 4000));
}

void bootstrap();

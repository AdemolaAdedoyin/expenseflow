import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

type ConfigureAppOptions = {
  enableSwagger?: boolean;
};

/**
 * Applies HTTP concerns that should behave the same in production and end-to-end tests.
 * Keeping this outside main.ts prevents tests from accidentally exercising a different
 * validation/CORS/global-prefix setup than the real application.
 */
export function configureApp(
  app: INestApplication,
  config: ConfigService,
  options: ConfigureAppOptions = {},
) {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (options.enableSwagger === false) {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ExpenseFlow API')
    .setDescription('Multi-tenant expense approval platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
}

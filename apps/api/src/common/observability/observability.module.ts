import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context';
import { StructuredLogger } from './structured-logger';

@Global()
@Module({
  providers: [RequestContextService, StructuredLogger],
  exports: [RequestContextService, StructuredLogger],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

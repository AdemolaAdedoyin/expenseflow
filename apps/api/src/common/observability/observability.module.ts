import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HttpMetricsService } from './http-metrics.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context';
import { StructuredLogger } from './structured-logger';

@Global()
@Module({
  providers: [HttpMetricsService, RequestContextService, StructuredLogger],
  exports: [HttpMetricsService, RequestContextService, StructuredLogger],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

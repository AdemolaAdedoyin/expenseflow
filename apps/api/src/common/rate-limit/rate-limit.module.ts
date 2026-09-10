import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { RateLimitService } from './rate-limit.service';

@Module({
  providers: [RateLimitService, RateLimitMiddleware],
})
export class RateLimitModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { HttpMetricsService } from './http-metrics.service';
import { RequestContextService } from './request-context';
import { StructuredLogger } from './structured-logger';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly context: RequestContextService,
    private readonly logger: StructuredLogger,
    private readonly metrics: HttpMetricsService,
  ) {}

  use(request: Request, response: Response, next: NextFunction) {
    const requestIdHeader = request.header('x-request-id');
    const traceparent = request.header('traceparent');
    const trace = this.context.create({
      requestId: requestIdHeader || undefined,
      traceparent: traceparent || undefined,
    });
    const startedAt = Date.now();

    response.setHeader('x-request-id', trace.requestId);
    response.setHeader('traceparent', this.context.toTraceparent(trace));

    this.context.run(trace, () => {
      response.on('finish', () => {
        const durationMs = Date.now() - startedAt;

        // Record only aggregate request metadata; payloads and identities never enter metrics.
        this.metrics.record(response.statusCode, durationMs);
        this.logger.log(
          {
            event: 'http.request.completed',
            method: request.method,
            path: request.originalUrl.split('?')[0],
            statusCode: response.statusCode,
            durationMs,
          },
          RequestContextMiddleware.name,
        );
      });

      next();
    });
  }
}

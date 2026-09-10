import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RateLimitDecision, RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly rateLimits: RateLimitService) {}

  use(request: Request, response: Response, next: NextFunction) {
    const path = request.originalUrl.split('?')[0];

    // Health probes should reflect application/dependency health rather than being
    // throttled by traffic from an orchestrator or external load balancer.
    if (path.endsWith('/health/live') || path.endsWith('/health/ready')) {
      next();
      return;
    }

    const clientKey = this.clientKey(request);
    const isSensitiveAuthRequest =
      request.method === 'POST' && (path.endsWith('/auth/login') || path.endsWith('/auth/refresh'));
    const policy = isSensitiveAuthRequest
      ? this.rateLimits.authPolicy()
      : this.rateLimits.generalPolicy();
    const scope = isSensitiveAuthRequest ? 'auth' : 'general';
    const decision = this.rateLimits.consume(
      `${scope}:${clientKey}`,
      policy.limit,
      policy.windowMs,
    );

    this.setHeaders(response, decision);

    if (!decision.allowed) {
      response.setHeader(
        'Retry-After',
        Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000)),
      );

      // Nest's built-in exception exports vary across major versions. Using the
      // generic HttpException keeps the HTTP contract stable without coupling this
      // middleware to a version-specific TooManyRequestsException export.
      throw new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    next();
  }

  private clientKey(request: Request) {
    // Express only trusts forwarded addresses when the application explicitly enables
    // a trusted proxy. Until then, request.ip is safer than accepting spoofable headers.
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private setHeaders(response: Response, decision: RateLimitDecision) {
    response.setHeader('RateLimit-Limit', decision.limit);
    response.setHeader('RateLimit-Remaining', decision.remaining);
    response.setHeader('RateLimit-Reset', Math.ceil(decision.resetAt / 1000));
  }
}

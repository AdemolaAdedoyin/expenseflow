import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { IDEMPOTENT_METADATA_KEY } from './idempotent.decorator';
import { IdempotencyService } from './idempotency.service';

type RequestUser = {
  sub: string;
  organizationId: string;
};

type RequestLike = {
  method: string;
  originalUrl: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  user?: RequestUser;
};

type ResponseLike = {
  statusCode: number;
  status(code: number): ResponseLike;
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const response = context.switchToHttp().getResponse<ResponseLike>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const keyHeader = request.headers['idempotency-key'];
    const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;

    if (!key || !key.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    if (key.length > 200) {
      throw new BadRequestException('Idempotency-Key must be 200 characters or fewer');
    }

    const method = request.method.toUpperCase();
    const path = request.originalUrl.split('?')[0];
    const requestHash = this.idempotency.hashRequest({
      method,
      path,
      body: request.body ?? null,
    });

    // Reserving the key before the handler runs closes the race where two concurrent
    // requests with the same key could both reach the domain service.
    const claim = await this.idempotency.claim({
      organizationId: user.organizationId,
      actorId: user.sub,
      key,
      method,
      path,
      requestHash,
    });

    // A completed claim is safe to replay because the stored request fingerprint must
    // match the current method, path, and body before claim() returns this branch.
    if (claim.kind === 'replay') {
      response.status(claim.responseStatus);
      return of(claim.responseBody);
    }

    return next.handle().pipe(
      mergeMap((body) =>
        from(this.idempotency.complete(claim.recordId, response.statusCode, body)).pipe(
          mergeMap(() => of(body)),
        ),
      ),
      catchError((error) =>
        // Failed requests do not consume the key permanently. Releasing a pending claim
        // lets a legitimate client retry after a transient failure.
        from(this.idempotency.release(claim.recordId)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }
}

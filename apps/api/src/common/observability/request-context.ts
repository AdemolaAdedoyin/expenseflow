import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';

export type TraceContext = {
  requestId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<TraceContext>();

  run<T>(context: TraceContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): TraceContext | undefined {
    return this.storage.getStore();
  }

  create(input?: { requestId?: string; traceparent?: string }): TraceContext {
    const incoming = input?.traceparent ? parseTraceparent(input.traceparent) : undefined;

    return {
      requestId: input?.requestId || randomUUID(),
      traceId: incoming?.traceId || randomHex(16),
      spanId: randomHex(8),
      parentSpanId: incoming?.spanId,
    };
  }

  child(parent: TraceContext): TraceContext {
    return {
      requestId: parent.requestId,
      traceId: parent.traceId,
      spanId: randomHex(8),
      parentSpanId: parent.spanId,
    };
  }

  toTraceparent(context: TraceContext) {
    return `00-${context.traceId}-${context.spanId}-01`;
  }
}

function randomHex(bytes: number) {
  return randomBytes(bytes).toString('hex');
}

function parseTraceparent(value: string) {
  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i.exec(value.trim());

  if (!match || /^0+$/.test(match[1]) || /^0+$/.test(match[2])) {
    return undefined;
  }

  return { traceId: match[1].toLowerCase(), spanId: match[2].toLowerCase() };
}

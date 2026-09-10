import { RequestContextService } from './request-context';

describe('RequestContextService', () => {
  const service = new RequestContextService();

  it('accepts an incoming W3C traceparent and creates a child server span', () => {
    const context = service.create({
      requestId: 'request-123',
      traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
    });

    expect(context.requestId).toBe('request-123');
    expect(context.traceId).toBe('0123456789abcdef0123456789abcdef');
    expect(context.parentSpanId).toBe('0123456789abcdef');
    expect(context.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('keeps the trace id while creating a child context for background work', () => {
    const parent = service.create();
    const child = service.child(parent);

    expect(child.traceId).toBe(parent.traceId);
    expect(child.requestId).toBe(parent.requestId);
    expect(child.parentSpanId).toBe(parent.spanId);
    expect(child.spanId).not.toBe(parent.spanId);
  });

  it('exposes context only inside the AsyncLocalStorage scope', () => {
    const context = service.create();

    expect(service.get()).toBeUndefined();
    service.run(context, () => expect(service.get()).toEqual(context));
    expect(service.get()).toBeUndefined();
  });
});

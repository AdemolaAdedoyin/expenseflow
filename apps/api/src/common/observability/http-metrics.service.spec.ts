import { HttpMetricsService } from './http-metrics.service';

describe('HttpMetricsService', () => {
  it('aggregates request count, server errors, latency, and status codes', () => {
    const metrics = new HttpMetricsService();

    metrics.record(200, 10);
    metrics.record(201, 20);
    metrics.record(500, 30);

    expect(metrics.snapshot()).toEqual({
      requestCount: 3,
      errorCount: 1,
      errorRate: 1 / 3,
      averageDurationMs: 20,
      statusCodes: { '200': 1, '201': 1, '500': 1 },
    });
  });

  it('returns a zeroed snapshot before the first request', () => {
    expect(new HttpMetricsService().snapshot()).toEqual({
      requestCount: 0,
      errorCount: 0,
      errorRate: 0,
      averageDurationMs: 0,
      statusCodes: {},
    });
  });
});

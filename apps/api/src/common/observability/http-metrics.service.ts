import { Injectable } from '@nestjs/common';

export type HttpMetricsSnapshot = {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  averageDurationMs: number;
  statusCodes: Record<string, number>;
};

/**
 * Keeps lightweight process-local counters for the operations dashboard.
 * These metrics intentionally avoid storing request payloads or user data.
 * A production deployment can later replace this adapter with Prometheus or
 * another metrics backend without changing the HTTP middleware contract.
 */
@Injectable()
export class HttpMetricsService {
  private requestCount = 0;
  private errorCount = 0;
  private totalDurationMs = 0;
  private readonly statusCodes = new Map<number, number>();

  record(statusCode: number, durationMs: number) {
    this.requestCount += 1;
    this.totalDurationMs += durationMs;
    this.statusCodes.set(statusCode, (this.statusCodes.get(statusCode) ?? 0) + 1);

    if (statusCode >= 500) {
      this.errorCount += 1;
    }
  }

  snapshot(): HttpMetricsSnapshot {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount === 0 ? 0 : this.errorCount / this.requestCount,
      averageDurationMs:
        this.requestCount === 0 ? 0 : Math.round((this.totalDurationMs / this.requestCount) * 100) / 100,
      statusCodes: Object.fromEntries(
        [...this.statusCodes.entries()].map(([status, count]) => [String(status), count]),
      ),
    };
  }
}

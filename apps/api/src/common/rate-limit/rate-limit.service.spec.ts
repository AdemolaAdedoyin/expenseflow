import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  const config = new ConfigService();
  const service = new RateLimitService(config);

  it('allows requests until the limit is exceeded', () => {
    const first = service.consume('test:allow', 2, 1_000, 1_000);
    const second = service.consume('test:allow', 2, 1_000, 1_100);
    const third = service.consume('test:allow', 2, 1_000, 1_200);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
  });

  it('starts a fresh bucket after the window expires', () => {
    service.consume('test:reset', 1, 1_000, 2_000);
    const reset = service.consume('test:reset', 1, 1_000, 3_000);

    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(0);
    expect(reset.resetAt).toBe(4_000);
  });
});

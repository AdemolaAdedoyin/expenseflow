// E2E tests exercise authorization and workflow behavior, not rate-limit exhaustion.
// Force generous limits before AppModule/ConfigModule are imported so a developer's
// local .env values cannot make the suite order-dependent or flaky.
process.env.RATE_LIMIT_REQUESTS = '10000';
process.env.AUTH_RATE_LIMIT_REQUESTS = '1000';

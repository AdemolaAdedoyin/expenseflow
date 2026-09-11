import { ConflictException } from '@nestjs/common';
import { IdempotencyStatus } from '@prisma/client';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  const prisma = {
    idempotencyRecord: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const service = new IdempotencyService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('hashes equivalent object bodies consistently regardless of key order', () => {
    const first = service.hashRequest({
      method: 'POST',
      path: '/api/expenses',
      body: { amountCents: 1000, merchant: 'Cafe' },
    });
    const second = service.hashRequest({
      method: 'POST',
      path: '/api/expenses',
      body: { merchant: 'Cafe', amountCents: 1000 },
    });

    expect(first).toBe(second);
  });

  it('replays a completed request with the same key and payload', async () => {
    prisma.idempotencyRecord.create.mockRejectedValue({ code: 'P2002' });
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'record-1',
      method: 'POST',
      path: '/api/expenses',
      requestHash: 'hash',
      status: IdempotencyStatus.COMPLETED,
      responseStatus: 201,
      responseBody: JSON.stringify({ id: 'expense-1' }),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const claim = await service.claim({
      organizationId: 'org-1',
      actorId: 'user-1',
      key: 'request-1',
      method: 'POST',
      path: '/api/expenses',
      requestHash: 'hash',
    });

    expect(claim).toEqual({
      kind: 'replay',
      responseStatus: 201,
      responseBody: { id: 'expense-1' },
    });
  });

  it('rejects reuse of a key for a different request', async () => {
    prisma.idempotencyRecord.create.mockRejectedValue({ code: 'P2002' });
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'record-1',
      method: 'POST',
      path: '/api/expenses',
      requestHash: 'different-hash',
      status: IdempotencyStatus.COMPLETED,
      responseStatus: 201,
      responseBody: '{}',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.claim({
        organizationId: 'org-1',
        actorId: 'user-1',
        key: 'request-1',
        method: 'POST',
        path: '/api/expenses',
        requestHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

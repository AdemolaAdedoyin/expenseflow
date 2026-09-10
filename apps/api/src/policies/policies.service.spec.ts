import { PolicyAction } from '@prisma/client';
import { PoliciesService } from './policies.service';

describe('PoliciesService', () => {
  it('combines matching policy actions', async () => {
    const transaction = {
      policy: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            category: null,
            minAmountCents: 10000,
            maxAmountCents: null,
            action: PolicyAction.REQUIRE_MANAGER,
            priority: 10,
          },
          {
            id: 'p2',
            category: 'Travel',
            minAmountCents: 250000,
            maxAmountCents: null,
            action: PolicyAction.REQUIRE_FINANCE,
            priority: 20,
          },
        ]),
      },
    };
    const prisma = {
      withTenant: jest.fn(
        async (_organizationId: string, callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as any;
    const service = new PoliciesService(prisma);

    await expect(service.evaluate('org', 300000, 'Travel')).resolves.toEqual({
      autoReject: false,
      requireManager: true,
      requireFinance: true,
      matchedPolicyIds: ['p1', 'p2'],
    });
  });
});

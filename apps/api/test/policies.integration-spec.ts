import { PolicyAction, PrismaClient } from '@prisma/client';
import { PoliciesService } from '../src/policies/policies.service';
import { clearDatabase } from './test-db';

describe('PoliciesService integration', () => {
  const prisma = new PrismaClient();
  const service = new PoliciesService(prisma as never);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await prisma.$disconnect();
  });

  it('composes manager and finance requirements from persisted policies', async () => {
    const organization = await prisma.organization.create({
      data: { name: 'Integration Co', slug: 'integration-co' },
    });

    await prisma.policy.createMany({
      data: [
        {
          organizationId: organization.id,
          name: 'Manager review',
          minAmountCents: 10_000,
          action: PolicyAction.REQUIRE_MANAGER,
          priority: 10,
        },
        {
          organizationId: organization.id,
          name: 'Finance review',
          minAmountCents: 250_000,
          action: PolicyAction.REQUIRE_FINANCE,
          priority: 20,
        },
      ],
    });

    const result = await service.evaluate(organization.id, 300_000, 'Travel');

    expect(result.autoReject).toBe(false);
    expect(result.requireManager).toBe(true);
    expect(result.requireFinance).toBe(true);
    expect(result.matchedPolicyIds).toHaveLength(2);
  });

  it('matches category rules case-insensitively against real database rows', async () => {
    const organization = await prisma.organization.create({
      data: { name: 'Meals Co', slug: 'meals-co' },
    });

    await prisma.policy.create({
      data: {
        organizationId: organization.id,
        name: 'Meals cap',
        category: 'Meals',
        minAmountCents: 15_001,
        action: PolicyAction.AUTO_REJECT,
      },
    });

    const result = await service.evaluate(organization.id, 20_000, 'meals');

    expect(result.autoReject).toBe(true);
    expect(result.matchedPolicyIds).toHaveLength(1);
  });
});

import { PrismaClient, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { assertTestDatabase, clearDatabase } from './test-db';

describe('PostgreSQL tenant row-level security', () => {
  const admin = new PrismaClient();
  const roleName = `expenseflow_rls_${process.pid}`;
  const password = randomBytes(18).toString('hex');
  let tenantClient: PrismaService;
  let organizationAId: string;
  let organizationBId: string;

  beforeAll(async () => {
    assertTestDatabase();
    await admin.$connect();
    await clearDatabase(admin);

    const organizationA = await admin.organization.create({
      data: { name: 'Tenant A', slug: `tenant-a-${process.pid}` },
    });
    const organizationB = await admin.organization.create({
      data: { name: 'Tenant B', slug: `tenant-b-${process.pid}` },
    });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const userA = await admin.user.create({
      data: {
        email: `tenant-a-${process.pid}@example.com`,
        passwordHash: 'test',
        firstName: 'Tenant',
        lastName: 'A',
        role: Role.EMPLOYEE,
        organizationId: organizationA.id,
      },
    });
    const userB = await admin.user.create({
      data: {
        email: `tenant-b-${process.pid}@example.com`,
        passwordHash: 'test',
        firstName: 'Tenant',
        lastName: 'B',
        role: Role.EMPLOYEE,
        organizationId: organizationB.id,
      },
    });

    await admin.expense.createMany({
      data: [
        {
          organizationId: organizationA.id,
          userId: userA.id,
          merchant: 'Tenant A merchant',
          amountCents: 1000,
          category: 'Travel',
          incurredAt: new Date(),
        },
        {
          organizationId: organizationB.id,
          userId: userB.id,
          merchant: 'Tenant B merchant',
          amountCents: 2000,
          category: 'Travel',
          incurredAt: new Date(),
        },
      ],
    });

    // The migration runner is privileged in CI, so this test creates a low-privilege
    // runtime role. PostgreSQL superusers bypass RLS and would give a false positive.
    await admin.$executeRawUnsafe(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${password}'`);
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${roleName}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT ON TABLE "Expense" TO "${roleName}"`);

    const tenantUrl = new URL(process.env.DATABASE_URL!);
    tenantUrl.username = roleName;
    tenantUrl.password = password;
    tenantClient = new PrismaService({
      datasources: { db: { url: tenantUrl.toString() } },
    });
    await tenantClient.$connect();
  });

  afterAll(async () => {
    await tenantClient?.$disconnect();
    await clearDatabase(admin);
    await admin.$executeRawUnsafe(`DROP OWNED BY "${roleName}"`);
    await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS "${roleName}"`);
    await admin.$disconnect();
  });

  it('returns no tenant rows when the connection has no tenant context', async () => {
    await expect(tenantClient.expense.findMany()).resolves.toEqual([]);
  });

  it('only exposes rows for the tenant set by withTenant()', async () => {
    const tenantAExpenses = await tenantClient.withTenant(organizationAId, (transaction) =>
      transaction.expense.findMany({ orderBy: { merchant: 'asc' } }),
    );

    expect(tenantAExpenses).toHaveLength(1);
    expect(tenantAExpenses[0].organizationId).toBe(organizationAId);
    expect(tenantAExpenses[0].merchant).toBe('Tenant A merchant');
    expect(tenantAExpenses[0].organizationId).not.toBe(organizationBId);
  });
});

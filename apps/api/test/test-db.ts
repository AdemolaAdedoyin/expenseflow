import { PrismaClient } from '@prisma/client';

/**
 * Integration tests intentionally use a real PostgreSQL database. This guard makes it
 * difficult to point the destructive cleanup helpers at a normal development database
 * by mistake.
 */
export function assertTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const databaseName = databaseUrl.split('/').pop()?.split('?')[0] ?? '';

  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error(
      `Refusing to run database tests against "${databaseName || 'unknown'}". DATABASE_URL must target a database whose name contains "test".`,
    );
  }
}

export async function clearDatabase(prisma: PrismaClient) {
  assertTestDatabase();

  // Delete children before parents to respect foreign-key constraints.
  await prisma.idempotencyRecord.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

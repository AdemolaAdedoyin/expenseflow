import { PrismaClient, PolicyAction, Role } from '@prisma/client';
import { hash } from 'bcrypt';
const prisma = new PrismaClient();
async function main() {
  await prisma.auditLog.deleteMany(); await prisma.approval.deleteMany(); await prisma.expense.deleteMany(); await prisma.policy.deleteMany(); await prisma.user.deleteMany(); await prisma.organization.deleteMany();
  const org = await prisma.organization.create({ data: { name: 'Acme Labs', slug: 'acme-labs' } });
  const passwordHash = await hash('Password123!', 10);
  const admin = await prisma.user.create({ data: { organizationId: org.id, email: 'admin@demo.com', passwordHash, firstName: 'Avery', lastName: 'Admin', role: Role.ADMIN, department: 'Operations' } });
  const finance = await prisma.user.create({ data: { organizationId: org.id, email: 'finance@demo.com', passwordHash, firstName: 'Finley', lastName: 'Reed', role: Role.FINANCE, department: 'Finance' } });
  const manager = await prisma.user.create({ data: { organizationId: org.id, email: 'manager@demo.com', passwordHash, firstName: 'Morgan', lastName: 'Lee', role: Role.MANAGER, department: 'Engineering' } });
  const employee = await prisma.user.create({ data: { organizationId: org.id, email: 'employee@demo.com', passwordHash, firstName: 'Jordan', lastName: 'Kim', role: Role.EMPLOYEE, department: 'Engineering', managerId: manager.id } });
  await prisma.policy.createMany({ data: [
    { organizationId: org.id, name: 'Manager review over $100+', minAmountCents: 10000, action: PolicyAction.REQUIRE_MANAGER, priority: 10 },
    { organizationId: org.id, name: 'Finance review over $2,500', minAmountCents: 250000, action: PolicyAction.REQUIRE_FINANCE, priority: 20 },
    { organizationId: org.id, name: 'Meals capped at $150', category: 'Meals', minAmountCents: 15001, action: PolicyAction.AUTO_REJECT, priority: 1 },
  ] });
  const samples = [
    ['GitHub', 1200, 'Software'], ['Delta Airlines', 48000, 'Travel'], ['Hilton', 138500, 'Travel'], ['Local Cafe', 4200, 'Meals'], ['AWS', 8900, 'Software']
  ] as const;
  for (const [merchant, amountCents, category] of samples) {
    await prisma.expense.create({ data: { organizationId: org.id, userId: employee.id, merchant, amountCents, category, incurredAt: new Date(), description: `Demo ${category.toLowerCase()} expense` } });
  }
  console.log({ demoPassword: 'Password123!', users: [admin.email, finance.email, manager.email, employee.email] });
}
main().finally(() => prisma.$disconnect());

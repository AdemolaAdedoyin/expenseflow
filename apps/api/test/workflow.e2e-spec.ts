import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PolicyAction, Role } from '@prisma/client';
import { hash } from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { clearDatabase } from './test-db';

type LoginResponse = {
  accessToken: string;
};

type ExpenseResponse = {
  id: string;
  status: string;
  version: number;
};

type ApprovalResponse = {
  id: string;
  version: number;
};

describe('Expense approval workflow e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prisma = app.get(PrismaService);

    // Reuse the same global prefix and validation pipeline as the real server.
    configureApp(app, app.get(ConfigService), { enableSwagger: false });
    await app.init();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    await seedWorkflowUsers();
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await app.close();
  });

  it('runs a manager then finance approval flow through the HTTP API', async () => {
    const employeeToken = await login('employee.e2e@demo.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .set('Idempotency-Key', 'e2e-create-expense')
      .send({
        merchant: 'E2E Hotel',
        amountCents: 300_000,
        category: 'Travel',
        incurredAt: new Date().toISOString(),
      })
      .expect(201);

    const created = createResponse.body as ExpenseResponse;
    expect(created.status).toBe('DRAFT');

    const submitResponse = await request(app.getHttpServer())
      .post(`/api/expenses/${created.id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .set('Idempotency-Key', 'e2e-submit-expense')
      .send({ expectedVersion: created.version })
      .expect(201);

    expect((submitResponse.body as ExpenseResponse).status).toBe('PENDING_MANAGER');

    const managerToken = await login('manager.e2e@demo.com');
    const managerInbox = await request(app.getHttpServer())
      .get('/api/approvals/inbox')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(managerInbox.body).toHaveLength(1);
    const managerApproval = managerInbox.body[0] as ApprovalResponse;

    const managerDecision = await request(app.getHttpServer())
      .post(`/api/approvals/${managerApproval.id}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', 'e2e-manager-approval')
      .send({ decision: 'APPROVE', expectedVersion: managerApproval.version })
      .expect(201);

    expect((managerDecision.body as ExpenseResponse).status).toBe('PENDING_FINANCE');

    const financeToken = await login('finance.e2e@demo.com');
    const financeInbox = await request(app.getHttpServer())
      .get('/api/approvals/inbox')
      .set('Authorization', `Bearer ${financeToken}`)
      .expect(200);

    expect(financeInbox.body).toHaveLength(1);
    const financeApproval = financeInbox.body[0] as ApprovalResponse;

    const financeDecision = await request(app.getHttpServer())
      .post(`/api/approvals/${financeApproval.id}/decision`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('Idempotency-Key', 'e2e-finance-approval')
      .send({ decision: 'APPROVE', expectedVersion: financeApproval.version })
      .expect(201);

    expect((financeDecision.body as ExpenseResponse).status).toBe('APPROVED');
  });

  it('enforces role restrictions at the API boundary', async () => {
    const managerToken = await login('manager.e2e@demo.com');

    await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', 'manager-cannot-create')
      .send({
        merchant: 'Forbidden expense',
        amountCents: 5_000,
        category: 'Travel',
        incurredAt: new Date().toISOString(),
      })
      .expect(403);
  });

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Password123!' })
      .expect(201);

    return (response.body as LoginResponse).accessToken;
  }

  async function seedWorkflowUsers() {
    const organization = await prisma.organization.create({
      data: { name: 'E2E Organization', slug: 'e2e-organization' },
    });
    const passwordHash = await hash('Password123!', 4);

    const manager = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: 'manager.e2e@demo.com',
        passwordHash,
        firstName: 'Morgan',
        lastName: 'Manager',
        role: Role.MANAGER,
      },
    });

    await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: 'finance.e2e@demo.com',
        passwordHash,
        firstName: 'Finley',
        lastName: 'Finance',
        role: Role.FINANCE,
      },
    });

    await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: 'employee.e2e@demo.com',
        passwordHash,
        firstName: 'Jordan',
        lastName: 'Employee',
        role: Role.EMPLOYEE,
        managerId: manager.id,
      },
    });

    await prisma.policy.createMany({
      data: [
        {
          organizationId: organization.id,
          name: 'Manager approval',
          minAmountCents: 10_000,
          action: PolicyAction.REQUIRE_MANAGER,
          priority: 10,
        },
        {
          organizationId: organization.id,
          name: 'Finance approval',
          minAmountCents: 250_000,
          action: PolicyAction.REQUIRE_FINANCE,
          priority: 20,
        },
      ],
    });
  }
});

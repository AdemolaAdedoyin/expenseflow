import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PolicyAction, Role } from '@prisma/client';
import { hash } from 'bcrypt';
import { AddressInfo } from 'net';
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

type ApiResponse<T> = {
  status: number;
  body: T;
};

describe('Expense approval workflow e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prisma = app.get(PrismaService);

    // Reuse the same global prefix and validation pipeline as the real server.
    configureApp(app, app.get(ConfigService), { enableSwagger: false });

    // Listen on an ephemeral port so the suite exercises the real HTTP stack without
    // competing with a developer's API process or another CI job.
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
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

    const createResponse = await call<ExpenseResponse>('POST', '/api/expenses', {
      token: employeeToken,
      idempotencyKey: 'e2e-create-expense',
      body: {
        merchant: 'E2E Hotel',
        amountCents: 300_000,
        category: 'Travel',
        incurredAt: new Date().toISOString(),
      },
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.status).toBe('DRAFT');

    const submitResponse = await call<ExpenseResponse>(
      'POST',
      `/api/expenses/${createResponse.body.id}/submit`,
      {
        token: employeeToken,
        idempotencyKey: 'e2e-submit-expense',
        body: { expectedVersion: createResponse.body.version },
      },
    );

    expect(submitResponse.status).toBe(201);
    expect(submitResponse.body.status).toBe('PENDING_MANAGER');

    const managerToken = await login('manager.e2e@demo.com');
    const managerInbox = await call<ApprovalResponse[]>('GET', '/api/approvals/inbox', {
      token: managerToken,
    });

    expect(managerInbox.status).toBe(200);
    expect(managerInbox.body).toHaveLength(1);

    const managerApproval = managerInbox.body[0];
    const managerDecision = await call<ExpenseResponse>(
      'POST',
      `/api/approvals/${managerApproval.id}/decision`,
      {
        token: managerToken,
        idempotencyKey: 'e2e-manager-approval',
        body: { decision: 'APPROVE', expectedVersion: managerApproval.version },
      },
    );

    expect(managerDecision.status).toBe(201);
    expect(managerDecision.body.status).toBe('PENDING_FINANCE');

    const financeToken = await login('finance.e2e@demo.com');
    const financeInbox = await call<ApprovalResponse[]>('GET', '/api/approvals/inbox', {
      token: financeToken,
    });

    expect(financeInbox.status).toBe(200);
    expect(financeInbox.body).toHaveLength(1);

    const financeApproval = financeInbox.body[0];
    const financeDecision = await call<ExpenseResponse>(
      'POST',
      `/api/approvals/${financeApproval.id}/decision`,
      {
        token: financeToken,
        idempotencyKey: 'e2e-finance-approval',
        body: { decision: 'APPROVE', expectedVersion: financeApproval.version },
      },
    );

    expect(financeDecision.status).toBe(201);
    expect(financeDecision.body.status).toBe('APPROVED');
  });

  it('enforces role restrictions at the API boundary', async () => {
    const managerToken = await login('manager.e2e@demo.com');
    const response = await call('POST', '/api/expenses', {
      token: managerToken,
      idempotencyKey: 'manager-cannot-create',
      body: {
        merchant: 'Forbidden expense',
        amountCents: 5_000,
        category: 'Travel',
        incurredAt: new Date().toISOString(),
      },
    });

    expect(response.status).toBe(403);
  });

  async function login(email: string) {
    const response = await call<LoginResponse>('POST', '/api/auth/login', {
      body: { email, password: 'Password123!' },
    });

    expect(response.status).toBe(201);
    return response.body.accessToken;
  }

  async function call<T = unknown>(
    method: string,
    path: string,
    options: {
      token?: string;
      idempotencyKey?: string;
      body?: unknown;
    } = {},
  ): Promise<ApiResponse<T>> {
    const headers = new Headers({ Accept: 'application/json' });

    if (options.token) {
      headers.set('Authorization', `Bearer ${options.token}`);
    }

    if (options.idempotencyKey) {
      headers.set('Idempotency-Key', options.idempotencyKey);
    }

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const body = (text ? JSON.parse(text) : undefined) as T;

    return { status: response.status, body };
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

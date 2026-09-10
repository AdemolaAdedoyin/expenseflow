# ExpenseFlow

A production-style, multi-tenant expense management and approval platform built to demonstrate senior full-stack/backend engineering skills.

## Why this project exists

Most portfolio applications stop at CRUD. ExpenseFlow models a business workflow with authorization boundaries, rule evaluation, multi-step approvals, asynchronous jobs, auditability, reporting, and tenant isolation.

### Architecture

```text
React / TypeScript
      |
      | REST + JWT
      v
NestJS API
  |        |         |
  |        |         +--> BullMQ --> Redis --> Notification worker
  |        |
  |        +--> Policy / approval state machine
  |
  +--> Prisma --> PostgreSQL
```

## Features

- Multi-tenant organization scoping
- JWT authentication
- RBAC: Admin, Finance, Manager, Employee
- Expense drafts and submission workflow
- Configurable policy engine
- Multi-stage Manager -> Finance approval routing
- Automatic policy rejection
- Transactional state changes
- Immutable-style audit events
- BullMQ/Redis background notification processing with retries
- PostgreSQL + Prisma
- Pagination and filtering
- Reporting/analytics endpoints
- Swagger/OpenAPI documentation
- React + TypeScript dashboard
- Seeded demo accounts/data
- Unit tests
- Docker Compose
- GitHub Actions CI

## Workflow example

```text
$75 expense
  -> no matching approval policy
  -> APPROVED

$850 expense
  -> manager rule matches
  -> PENDING_MANAGER
  -> manager approves
  -> APPROVED

$4,500 expense
  -> manager + finance rules match
  -> PENDING_MANAGER
  -> manager approves
  -> PENDING_FINANCE
  -> finance approves
  -> APPROVED

$175 Meals expense
  -> meal cap rule matches
  -> REJECTED automatically
```

## Tech stack

**Backend:** Node.js, TypeScript, NestJS, PostgreSQL, Prisma, Redis, BullMQ, Passport/JWT, class-validator, Swagger

**Frontend:** React, TypeScript, Vite, TanStack Query, React Router

**Platform:** Docker Compose, GitHub Actions

## Quick start

Prerequisites: Node.js 22+, Docker.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Open:

- Web app: http://localhost:5173
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/docs

## Demo users

All demo users use password `Password123!`.

| Role | Email |
|---|---|
| Employee | employee@demo.com |
| Manager | manager@demo.com |
| Finance | finance@demo.com |
| Admin | admin@demo.com |

A useful demo is to sign in as Employee, create and submit an expense, then sign in as Manager/Finance to approve it.

## API highlights

```text
POST   /api/auth/login
GET    /api/auth/me
GET    /api/users

POST   /api/expenses
GET    /api/expenses
GET    /api/expenses/:id
POST   /api/expenses/:id/submit

GET    /api/approvals/inbox
POST   /api/approvals/:id/decision

GET    /api/policies
POST   /api/policies
DELETE /api/policies/:id

GET    /api/audit
GET    /api/reports/dashboard
```

## Backend design notes

### Tenant isolation

The authenticated JWT carries an `organizationId`. Business queries scope records by that organization rather than trusting organization IDs supplied by clients.

### Approval state machine

Approval state is persisted explicitly. Finance approval remains inactive until manager approval succeeds, preventing out-of-order approval in a two-level workflow.

### Policy engine

Policies match against category and amount ranges. Multiple policies can match one expense, allowing the workflow to compose requirements such as manager + finance review.

### Transactions

Submission and approval decisions use Prisma transactions when multiple database rows must transition together.

### Async jobs

Notifications are sent through BullMQ rather than within the HTTP request path. Jobs use retry/backoff configuration. The demo notification adapter logs to the console so the project is runnable without paid third-party services; the worker is intentionally isolated so SES/SendGrid can replace it.

### Audit trail

Important domain actions write audit records containing actor, entity, action and structured metadata.

## Production improvements

If this were deployed beyond a portfolio/demo environment, the next changes would be:

- Refresh-token rotation and session revocation
- SSO/SAML/OIDC
- Object storage + pre-signed receipt uploads
- Real email provider adapter
- Fine-grained permissions rather than role-only RBAC
- PostgreSQL row-level security as an additional tenant boundary
- Distributed tracing and structured logging
- Metrics and queue dashboards
- Idempotency keys on mutation endpoints
- Optimistic locking/versioning for high-contention workflows
- Integration and end-to-end test suites

## Repository layout

```text
expenseflow/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   └── src/
│   │       ├── auth/
│   │       ├── expenses/
│   │       ├── approvals/
│   │       ├── policies/
│   │       ├── audit/
│   │       ├── notifications/
│   │       └── reports/
│   └── web/
│       └── src/
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

## Talking points for interviews

This repository gives you concrete topics to discuss: tenant boundaries, domain-driven state transitions, synchronous vs asynchronous work, transaction boundaries, queue retry semantics, approval race conditions, data-model tradeoffs, policy composition, indexes, API authorization, and how you would scale the architecture.

## License

MIT

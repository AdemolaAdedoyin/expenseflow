# ExpenseFlow

I built ExpenseFlow as a production-style, multi-tenant expense management and approval platform. It focuses on the parts of business software that are more interesting than basic CRUD: authorization boundaries, policy evaluation, multi-step approvals, asynchronous work, auditability, reporting, and tenant isolation.

## Architecture

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
- Audit events for important domain actions
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
- Prettier + EditorConfig formatting

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

A simple end-to-end demo is to sign in as Employee, create and submit an expense, then sign in as Manager or Finance to approve it.

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

## Design notes

### Tenant isolation

I carry the authenticated user's `organizationId` in the JWT and scope business queries by that organization. I do not trust organization IDs supplied by clients for authorization decisions.

### Approval state machine

I persist approval state explicitly. Finance approval stays inactive until manager approval succeeds, which prevents an expense from moving through the workflow out of order.

### Policy engine

I evaluate policies against category and amount ranges. More than one policy can match the same expense, so I can compose requirements such as manager review plus finance review.

### Transactions

I use Prisma transactions when a submission or approval decision needs multiple database rows to move together. That keeps the expense state and its approval records consistent.

### Async jobs

I send notifications through BullMQ instead of doing that work inside the HTTP request path. Jobs use retry/backoff configuration. The current notification adapter writes to the console so the application stays easy to run locally, while the worker remains isolated enough for me to replace the adapter with SES, SendGrid, or another provider later.

### Audit trail

I record important domain actions with the actor, entity, action, and structured metadata so workflow changes can be traced without relying on application logs alone.

### Authorization

I enforce role restrictions at the API layer and mirror those permissions in the frontend so users only see actions that are available to them. The backend remains the source of truth for authorization.

## Planned improvements

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

I remove items from this list as I implement them so it reflects the work that is actually still outstanding.

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

## License

MIT

# ExpenseFlow

I built ExpenseFlow as a production-style, multi-tenant expense management and approval platform. The project goes beyond CRUD and focuses on authorization boundaries, policy evaluation, multi-step approvals, asynchronous work, auditability, tenant isolation, secure sessions, private file handling, resilient mutations, concurrency control, background email delivery, and operational visibility.

## Architecture

```text
React / TypeScript
      |
      | REST + JWT
      v
NestJS API
  |        |         |          |
  |        |         |          +--> S3 private receipt storage
  |        |         |
  |        |         +--> BullMQ --> Redis --> Notification worker --> Console / Amazon SES
  |        |
  |        +--> Policy / approval state machine
  |
  +--> Prisma --> PostgreSQL
```

## Features

- Multi-tenant organization scoping
- Short-lived JWT access tokens with rotating, revocable refresh sessions
- HttpOnly refresh-token cookies
- Capability-based authorization for Admin, Finance, Manager, and Employee roles
- Global API rate limiting with stricter authentication limits
- Expense drafts, submission, policy evaluation, and multi-stage approvals
- Private S3 receipt storage with short-lived pre-signed access
- Idempotency keys for important mutations
- Optimistic locking for workflow transitions
- Transactional state changes and audit events
- BullMQ/Redis notification processing with retries
- Amazon SES provider with a local console fallback
- Structured JSON logs and W3C trace-context propagation
- Protected Operations dashboard for API and queue metrics
- Liveness and readiness probes for PostgreSQL/Redis-aware deployments
- PostgreSQL + Prisma
- Swagger/OpenAPI documentation
- React + TypeScript dashboard
- Unit, integration, and end-to-end API tests
- Docker Compose and GitHub Actions CI
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

**Storage:** Amazon S3 with private objects and short-lived pre-signed access

**Email:** Amazon SES with a local console provider fallback

**Platform:** Docker Compose, GitHub Actions

## Quick start

Prerequisites: Node.js 22+ and Docker.

```bash
cp .env.example .env
docker compose up -d
npm ci
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

For normal local development after initial setup, I use:

```bash
npm run dev:local
```

That applies pending migrations and then starts both the API and web app. `npm run dev` still regenerates Prisma Client before startup.

Open:

- Web app: http://localhost:5173
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/docs

## Testing

```bash
npm test
npm run test:integration
npm run test:e2e
```

The database-backed suites refuse to run unless `DATABASE_URL` points to a database whose name contains `test`. The end-to-end suite boots the real NestJS module and covers authentication, authorization, idempotent mutations, and the Employee -> Manager -> Finance approval path against PostgreSQL and Redis.

## Authentication and authorization

I keep access tokens short-lived and use an opaque refresh token in an HttpOnly cookie for longer-lived browser sessions. Only a SHA-256 hash of each refresh token is stored in PostgreSQL. Refreshing rotates the session token, signing out revokes the current session, and the API can revoke all active sessions for a user.

I authorize endpoints using named business capabilities such as `expense:create`, `expense:submit`, `approval:review`, and `policy:manage`. I mirror those checks in React for navigation and actions, while the NestJS permission guard remains the authorization boundary.

## Rate limiting

I apply a process-local fixed-window limit to API traffic and a stricter limit to login/refresh requests. Health probes are excluded so orchestrator checks are not throttled. Responses include standard rate-limit metadata and return HTTP 429 with `Retry-After` when a client exceeds the active window.

The defaults can be adjusted with:

```text
RATE_LIMIT_REQUESTS=300
RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_REQUESTS=10
AUTH_RATE_LIMIT_WINDOW_MS=600000
```

The limiter is intentionally isolated behind a service so a shared Redis-backed implementation can replace the process-local store when the API runs across multiple replicas.

## Observability and operations

Every HTTP request gets a request ID and W3C trace context. Structured application logs include the active `requestId`, `traceId`, and `spanId`, and BullMQ notification jobs carry trace context into asynchronous processing.

Finance and Admin users also have a protected Operations page showing request totals, server-error rate, average latency, status-code distribution, and BullMQ notification queue counts.

Deployment health endpoints are public so an orchestrator can check them without authentication:

```text
GET /api/health/live
GET /api/health/ready
```

Liveness reports whether the API process is running. Readiness checks PostgreSQL and Redis and returns HTTP 503 when the application cannot safely receive traffic.

## Receipt storage

I upload receipts directly from the browser to a private S3 bucket instead of proxying file bytes through the API. The API validates expense ownership, draft state, file type, and declared size before issuing a short-lived signed upload policy. It validates the resulting object key again before attaching the receipt to the expense.

Receipt upload/download requires AWS credentials and `S3_RECEIPTS_BUCKET`. JPEG, PNG, and PDF receipts are supported up to 10 MB.

## Async jobs and email

I enqueue notifications through BullMQ instead of making provider calls in the HTTP request path. Local development defaults to console delivery; configured environments can use Amazon SES. BullMQ owns retry and exponential backoff for transient provider failures.

## Concurrency and resilient mutations

I require idempotency keys on important state-changing endpoints. Each key is scoped to the authenticated actor and tenant and bound to a request fingerprint. Replaying an identical request returns the original result, while reusing the key for different request data is rejected.

I also version expenses and approvals that participate in workflow transitions. The client sends the version it last read, and a stale competing request receives HTTP 409 instead of overwriting newer state.

## Demo users

All demo users use password `Password123!`.

| Role | Email |
|---|---|
| Employee | employee@demo.com |
| Manager | manager@demo.com |
| Finance | finance@demo.com |
| Admin | admin@demo.com |

## API highlights

```text
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/logout-all
GET    /api/auth/me

POST   /api/expenses
GET    /api/expenses
GET    /api/expenses/:id
POST   /api/expenses/:id/receipt-upload
POST   /api/expenses/:id/receipt-upload/complete
GET    /api/expenses/:id/receipt
POST   /api/expenses/:id/submit

GET    /api/approvals/inbox
POST   /api/approvals/:id/decision

GET    /api/policies
POST   /api/policies
DELETE /api/policies/:id

GET    /api/audit
GET    /api/reports/dashboard
GET    /api/operations/overview
GET    /api/health/live
GET    /api/health/ready
```

## Planned improvements

- SSO/SAML/OIDC
- PostgreSQL row-level security as an additional tenant boundary

I remove items from this list as I implement them so it reflects work that is actually still outstanding.

## Repository layout

```text
expenseflow/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   ├── src/
│   │   └── test/
│   └── web/
│       └── src/
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

## License

MIT

# ExpenseFlow

I built ExpenseFlow as a production-style, multi-tenant expense management and approval platform. It focuses on the parts of business software that are more interesting than basic CRUD: authorization boundaries, policy evaluation, multi-step approvals, asynchronous work, auditability, reporting, tenant isolation, secure sessions, private file handling, resilient mutations, concurrency control, and background email delivery.

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
- Short-lived JWT access tokens
- Rotating refresh tokens backed by revocable sessions
- HttpOnly refresh-token cookies
- RBAC: Admin, Finance, Manager, Employee
- Expense drafts and submission workflow
- Private S3 receipt storage with pre-signed upload and download access
- Configurable policy engine
- Multi-stage Manager -> Finance approval routing
- Automatic policy rejection
- Transactional state changes
- Idempotency keys for state-changing API requests
- Optimistic locking for expense and approval state transitions
- Audit events for important domain actions
- BullMQ/Redis background notification processing with retries
- Pluggable email provider with Amazon SES delivery and console fallback
- PostgreSQL + Prisma
- Pagination and filtering
- Reporting/analytics endpoints
- Swagger/OpenAPI documentation
- React + TypeScript dashboard
- Seeded demo accounts/data
- Unit, integration, and end-to-end API tests
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

**Storage:** Amazon S3 with private objects and short-lived pre-signed access

**Email:** Amazon SES with a local console provider fallback

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

For normal local development after the initial setup, I use:

```bash
npm run dev:local
```

That command applies pending migrations and then starts both the API and web app. `npm run dev` still regenerates Prisma Client automatically before startup.

Open:

- Web app: http://localhost:5173
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/docs

## Testing

The API has three test layers:

```bash
npm test                  # fast unit tests
npm run test:integration  # real PostgreSQL integration tests
npm run test:e2e          # full NestJS HTTP workflow tests
```

The database-backed suites refuse to run unless `DATABASE_URL` points to a database whose name contains `test`. This protects a normal development database from the cleanup operations used by the suites.

The end-to-end suite boots the real NestJS module and reuses the same global prefix and validation setup as the running API. It covers authentication, role enforcement, idempotent mutations, and the Employee -> Manager -> Finance approval path against PostgreSQL and Redis. GitHub Actions runs all three test layers before the build step.

## Receipt storage

Receipt uploads are optional. The rest of the application runs without AWS credentials, but uploading or opening a receipt requires these values:

```text
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_RECEIPTS_BUCKET
```

`AWS_SESSION_TOKEN` is also supported when I use temporary AWS credentials.

I keep the S3 bucket private. The browser never receives AWS credentials. The API creates a five-minute pre-signed POST policy for JPEG, PNG, and PDF receipts up to 10 MB, and it generates a separate five-minute pre-signed GET URL when an authorized user opens a receipt. Object keys are scoped by organization and expense.

For browser uploads, the S3 bucket needs CORS that permits the web application's origin to send `POST` requests. For local development, an example is:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["POST"],
    "AllowedOrigins": ["http://localhost:5173"],
    "ExposeHeaders": []
  }
]
```

The AWS principal used by the API should be limited to the receipt bucket and only the object operations the application needs rather than broad S3 access.

## Email delivery

Notifications continue to flow through BullMQ. The queue worker delegates delivery to an email-provider abstraction so local development can stay zero-cost while deployed environments can use Amazon SES.

Local development defaults to:

```text
EMAIL_PROVIDER=console
```

To send real email through SES, configure:

```text
EMAIL_PROVIDER=ses
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
SES_FROM_EMAIL
```

`AWS_SESSION_TOKEN` is supported for temporary credentials. The configured SES sender must be verified, and accounts that are still in the SES sandbox can only send to verified recipients. The AWS principal should have permission to send email through SES without broader account access.

I keep provider-specific logic behind the notification worker so the expense and approval domain services only enqueue notification jobs. BullMQ handles retries and exponential backoff if the provider call fails.

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
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/logout-all
GET    /api/auth/me
GET    /api/users

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
```

Mutation endpoints marked as idempotent require an `Idempotency-Key` header. The web client generates one automatically and preserves it across an access-token refresh/retry.

State-sensitive expense and approval mutations also send an `expectedVersion`. If another request has already changed the resource, the API returns HTTP 409 instead of overwriting the newer state.

## Design notes

### Tenant isolation

I carry the authenticated user's `organizationId` in the JWT and scope business queries by that organization. I do not trust organization IDs supplied by clients for authorization decisions.

### Authentication and sessions

I keep access tokens short-lived and use an opaque refresh token in an HttpOnly cookie for longer-lived browser sessions. I store only a SHA-256 hash of each refresh token in PostgreSQL. Each successful refresh revokes the old session token and creates a replacement, so a refresh token cannot be reused indefinitely. Signing out revokes the current session, and the API also supports revoking every active session for a user.

### Receipt storage

I upload receipts directly from the browser to a private S3 bucket instead of proxying file bytes through the API. The API creates a short-lived signed POST policy after checking the expense owner, draft state, content type, and declared file size. After S3 accepts the upload, the client completes the attachment with the API, which validates that the object key belongs to that organization and expense before storing its S3 URI. Authorized receipt reads use short-lived signed GET URLs.

### Approval state machine

I persist approval state explicitly. Finance approval stays inactive until manager approval succeeds, which prevents an expense from moving through the workflow out of order.

### Policy engine

I evaluate policies against category and amount ranges. More than one policy can match the same expense, so I can compose requirements such as manager review plus finance review.

### Transactions

I use Prisma transactions when a submission or approval decision needs multiple database rows to move together. That keeps the expense state and its approval records consistent.

### Idempotency

I require idempotency keys on important state-changing endpoints such as expense creation/submission, receipt attachment, approval decisions, and policy mutations. I reserve each key before executing the mutation, scope it to the tenant and authenticated actor, hash the method/path/body, and persist the completed response for 24 hours. Replaying the same request returns the original response, while reusing the same key for different request data is rejected. If the original request fails, I release the reservation so a legitimate retry can run again.

### Optimistic concurrency control

I version expenses and approvals that participate in workflow transitions. The client sends the version it last read, and the API updates rows only when that version and the expected workflow state still match. Successful mutations increment the version. If two different requests try to submit or decide the same workflow item concurrently, only the first matching update succeeds; the stale request receives HTTP 409 and is prompted to refresh rather than silently overwriting a newer decision. I use this alongside idempotency because they solve different problems: idempotency makes retries safe, while optimistic locking protects against competing requests with different idempotency keys.

### Async jobs and email

I enqueue notifications through BullMQ instead of performing provider calls in the HTTP request path. The worker uses a provider abstraction: console delivery is the local default, while Amazon SES provides real delivery in configured environments. Provider failures bubble back to BullMQ so the queue's retry and exponential-backoff policy remains responsible for transient delivery failures.

### Audit trail

I record important domain actions with the actor, entity, action, and structured metadata so workflow changes can be traced without relying on application logs alone.

### Authorization

I enforce role restrictions at the API layer and mirror those permissions in the frontend so users only see actions that are available to them. The backend remains the source of truth for authorization.

### Test strategy

I keep fast unit tests for isolated behavior, PostgreSQL integration tests for persistence-sensitive logic, and end-to-end tests for HTTP contracts and complete approval workflows. The database suites run serially and clean their own test data so race conditions in the test runner do not hide application-level concurrency problems.

## Planned improvements

- SSO/SAML/OIDC
- Fine-grained permissions rather than role-only RBAC
- PostgreSQL row-level security as an additional tenant boundary
- Distributed tracing and structured logging
- Metrics and queue dashboards

I remove items from this list as I implement them so it reflects the work that is actually still outstanding.

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

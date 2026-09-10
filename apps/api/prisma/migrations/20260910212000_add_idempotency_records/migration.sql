CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_organizationId_actorId_key_key"
ON "IdempotencyRecord"("organizationId", "actorId", "key");

CREATE INDEX "IdempotencyRecord_expiresAt_idx"
ON "IdempotencyRecord"("expiresAt");

CREATE INDEX "IdempotencyRecord_organizationId_actorId_createdAt_idx"
ON "IdempotencyRecord"("organizationId", "actorId", "createdAt");

ALTER TABLE "IdempotencyRecord"
ADD CONSTRAINT "IdempotencyRecord_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

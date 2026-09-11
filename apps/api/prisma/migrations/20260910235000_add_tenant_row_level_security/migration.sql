-- RLS is a second tenant boundary underneath the explicit organization filters in the API.
-- The application sets app.current_organization_id with set_config(..., true) inside an
-- interactive transaction, so the value is connection-local and automatically cleared
-- when the transaction ends.

ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" FORCE ROW LEVEL SECURITY;

CREATE POLICY "expense_tenant_isolation" ON "Expense"
USING (
  "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
)
WITH CHECK (
  "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
);

ALTER TABLE "Policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Policy" FORCE ROW LEVEL SECURITY;

CREATE POLICY "policy_tenant_isolation" ON "Policy"
USING (
  "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
)
WITH CHECK (
  "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
);

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_tenant_isolation" ON "AuditLog"
USING (
  "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
)
WITH CHECK (
  "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
);

-- Approval does not duplicate organizationId. Its policy derives tenant ownership from
-- the parent expense so there is still one source of truth for approval tenancy.
ALTER TABLE "Approval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Approval" FORCE ROW LEVEL SECURITY;

CREATE POLICY "approval_tenant_isolation" ON "Approval"
USING (
  EXISTS (
    SELECT 1
    FROM "Expense"
    WHERE "Expense"."id" = "Approval"."expenseId"
      AND "Expense"."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "Expense"
    WHERE "Expense"."id" = "Approval"."expenseId"
      AND "Expense"."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
  )
);

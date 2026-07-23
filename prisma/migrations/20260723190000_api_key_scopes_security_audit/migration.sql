-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateEnum
CREATE TYPE "SecurityAuditAction" AS ENUM (
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'SESSION_REVOKED',
  'SESSIONS_REVOKED_OTHERS',
  'API_KEY_CREATED',
  'API_KEY_REVOKED',
  'API_KEY_ROTATED',
  'PASSWORD_CHANGED',
  'ROLE_CHANGED'
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" UUID NOT NULL,
    "action" "SecurityAuditAction" NOT NULL,
    "actor_id" UUID,
    "subject_id" UUID,
    "workspace_id" UUID,
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_audit_logs_actor_id_created_at_idx" ON "security_audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "security_audit_logs_subject_id_created_at_idx" ON "security_audit_logs"("subject_id", "created_at");

-- CreateIndex
CREATE INDEX "security_audit_logs_workspace_id_created_at_idx" ON "security_audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "security_audit_logs_action_created_at_idx" ON "security_audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

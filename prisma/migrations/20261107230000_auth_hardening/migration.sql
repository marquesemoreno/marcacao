-- Login mais seguro (07/11/2026): revogar sessões, 2FA, histórico de login, esqueci a senha.
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "totp_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" TIMESTAMP(3);

CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "clinic_id" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "login_events_clinic_id_created_at_idx" ON "login_events"("clinic_id", "created_at");
CREATE INDEX "login_events_user_id_created_at_idx" ON "login_events"("user_id", "created_at");

CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

ALTER TABLE "login_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;

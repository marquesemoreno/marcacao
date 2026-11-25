ALTER TABLE "broadcast_campaigns" ADD COLUMN IF NOT EXISTS "ai_follow_up" BOOLEAN NOT NULL DEFAULT false;

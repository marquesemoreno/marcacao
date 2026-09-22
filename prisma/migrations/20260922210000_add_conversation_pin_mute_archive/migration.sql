ALTER TABLE "conversations" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN "muted_until" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "messages" ADD COLUMN "contact_reaction" TEXT;
ALTER TABLE "messages" ADD COLUMN "agent_reaction" TEXT;
ALTER TABLE "messages" ADD COLUMN "starred_at" TIMESTAMP(3);

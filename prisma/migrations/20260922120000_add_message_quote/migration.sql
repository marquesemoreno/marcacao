ALTER TABLE "messages" ADD COLUMN "quoted_message_id" TEXT;

ALTER TABLE "messages" ADD CONSTRAINT "messages_quoted_message_id_fkey" FOREIGN KEY ("quoted_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

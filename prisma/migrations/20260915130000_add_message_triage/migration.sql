CREATE TABLE "message_triage" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_content" TEXT NOT NULL,
    "red_flags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_triage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_triage_conversation_id_idx" ON "message_triage"("conversation_id");

ALTER TABLE "message_triage" ADD CONSTRAINT "message_triage_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "message_triage" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "conversation_quality_audits" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sentiment" TEXT,
    "summary" TEXT,
    "compliance_notes" TEXT,
    "first_response_sec" INTEGER,
    "resolution_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_quality_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_quality_audits_conversation_id_key" ON "conversation_quality_audits"("conversation_id");

CREATE INDEX "conversation_quality_audits_conversation_id_idx" ON "conversation_quality_audits"("conversation_id");

ALTER TABLE "conversation_quality_audits" ADD CONSTRAINT "conversation_quality_audits_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversation_quality_audits" ENABLE ROW LEVEL SECURITY;

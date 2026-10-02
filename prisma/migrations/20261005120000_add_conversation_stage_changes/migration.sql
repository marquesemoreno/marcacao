CREATE TABLE "conversation_stage_changes" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "from_stage" "conversation_funnel_stage" NOT NULL,
    "to_stage" "conversation_funnel_stage" NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_stage_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "conversation_stage_changes_conversation_id_created_at_idx" ON "conversation_stage_changes"("conversation_id", "created_at");
ALTER TABLE "conversation_stage_changes" ADD CONSTRAINT "conversation_stage_changes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_stage_changes" ADD CONSTRAINT "conversation_stage_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

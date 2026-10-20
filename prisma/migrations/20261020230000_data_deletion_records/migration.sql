CREATE TABLE "data_deletion_records" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "masked_phone" TEXT,
    "reason" TEXT NOT NULL,
    "messages_deleted" INTEGER NOT NULL,
    "contact_anonymized" BOOLEAN NOT NULL,
    "performed_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "data_deletion_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_processes" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "change_note" TEXT,
    "updated_by_user_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clinic_processes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clinic_processes_clinic_id_sector_key" ON "clinic_processes"("clinic_id", "sector");

CREATE TABLE "process_feedback" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "user_id" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOVA',
    "ai_answer" TEXT,
    "manager_reply" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "process_feedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "process_feedback_clinic_id_status_idx" ON "process_feedback"("clinic_id", "status");
ALTER TABLE "process_feedback" ADD CONSTRAINT "process_feedback_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "clinic_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS como as demais tabelas (acesso só pelo servidor).
ALTER TABLE "clinic_processes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "process_feedback" ENABLE ROW LEVEL SECURITY;

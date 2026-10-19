-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "doctor_name" TEXT,
    "period" TEXT NOT NULL DEFAULT 'ANY',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "offered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_entries_clinic_id_status_idx" ON "waitlist_entries"("clinic_id", "status");

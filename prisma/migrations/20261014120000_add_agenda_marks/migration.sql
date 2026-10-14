CREATE TABLE "agenda_marks" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agenda_marks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agenda_marks_clinic_id_source_external_id_key" ON "agenda_marks"("clinic_id", "source", "external_id");
CREATE INDEX "agenda_marks_clinic_id_date_idx" ON "agenda_marks"("clinic_id", "date");

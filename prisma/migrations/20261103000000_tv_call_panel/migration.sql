-- Painel de chamada da TV + função Médico
ALTER TABLE "users" ADD COLUMN "doctor_name" TEXT;

CREATE TABLE "tv_displays" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tv_displays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tv_displays_token_hash_key" ON "tv_displays"("token_hash");
CREATE INDEX "tv_displays_clinic_id_idx" ON "tv_displays"("clinic_id");

CREATE TABLE "doctor_rooms" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "doctor_key" TEXT NOT NULL,
    "doctor" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "doctor_rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "doctor_rooms_clinic_id_doctor_key_key" ON "doctor_rooms"("clinic_id", "doctor_key");

CREATE TABLE "patient_calls" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "spoken_name" TEXT NOT NULL,
    "doctor" TEXT,
    "room" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "called_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patient_calls_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "patient_calls_clinic_id_created_at_idx" ON "patient_calls"("clinic_id", "created_at");

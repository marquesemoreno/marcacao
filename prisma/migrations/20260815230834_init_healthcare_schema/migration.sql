-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'CLINIC', 'PATIENT');

-- CreateEnum
CREATE TYPE "procedure_category" AS ENUM ('CONSULTATION', 'EXAM', 'SURGERY');

-- CreateEnum
CREATE TYPE "appointment_type" AS ENUM ('SCHEDULED', 'ARRIVAL_ORDER');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'PATIENT',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade_name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "commission_rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedures" (
    "id" TEXT NOT NULL,
    "specialty_id" TEXT,
    "name" TEXT NOT NULL,
    "category" "procedure_category" NOT NULL,
    "description" TEXT,
    "preparation_instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_procedures" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "procedure_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "promotional_price" DECIMAL(10,2),
    "requires_appointment" BOOLEAN NOT NULL DEFAULT true,
    "appointment_type" "appointment_type" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "clinic_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_phone" TEXT NOT NULL,
    "patient_cpf" TEXT NOT NULL,
    "clinic_procedure_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time_slot" TEXT,
    "status" "appointment_status" NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "response_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clinics_cnpj_key" ON "clinics"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_name_key" ON "specialties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "procedures_name_key" ON "procedures"("name");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_procedures_clinic_id_procedure_id_key" ON "clinic_procedures"("clinic_id", "procedure_id");

-- CreateIndex
CREATE INDEX "appointments_clinic_procedure_id_date_idx" ON "appointments"("clinic_procedure_id", "date");

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_procedures" ADD CONSTRAINT "clinic_procedures_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_procedures" ADD CONSTRAINT "clinic_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_procedure_id_fkey" FOREIGN KEY ("clinic_procedure_id") REFERENCES "clinic_procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

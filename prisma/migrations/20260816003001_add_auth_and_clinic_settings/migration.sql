-- AlterEnum
ALTER TYPE "appointment_status" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "business_hours" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "clinic_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

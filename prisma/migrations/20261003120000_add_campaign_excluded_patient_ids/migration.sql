ALTER TABLE "clinics" ADD COLUMN "campaign_excluded_patient_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

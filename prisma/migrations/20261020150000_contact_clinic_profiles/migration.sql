CREATE TABLE "contact_clinic_profiles" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "cpf" TEXT,
    "rg" TEXT,
    "birth_date" DATE,
    "address" TEXT,
    "insurance_card_number" TEXT,
    "convenio" TEXT,
    "preferred_doctor" TEXT,
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contact_clinic_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contact_clinic_profiles_contact_id_clinic_id_key" ON "contact_clinic_profiles"("contact_id", "clinic_id");
CREATE INDEX "contact_clinic_profiles_clinic_id_idx" ON "contact_clinic_profiles"("clinic_id");
ALTER TABLE "contact_clinic_profiles" ADD CONSTRAINT "contact_clinic_profiles_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_clinic_profiles" ADD CONSTRAINT "contact_clinic_profiles_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cópia dos dados atuais para cada clínica que já conversa com o contato (os campos em
-- "contacts" ficam como estão por enquanto; são limpos depois que o código novo estiver no ar).
INSERT INTO "contact_clinic_profiles" ("id", "contact_id", "clinic_id", "cpf", "rg", "birth_date", "address", "insurance_card_number", "convenio", "preferred_doctor", "notes", "updated_at")
SELECT DISTINCT ON (c."id", cv."clinic_id")
  'ccp_' || md5(c."id" || cv."clinic_id"), c."id", cv."clinic_id", c."cpf", c."rg", c."birth_date", c."address", c."insurance_card_number", c."convenio", c."preferred_doctor", c."notes", NOW()
FROM "contacts" c
JOIN "conversations" cv ON cv."contact_id" = c."id"
WHERE c."cpf" IS NOT NULL OR c."rg" IS NOT NULL OR c."birth_date" IS NOT NULL OR c."address" IS NOT NULL
   OR c."insurance_card_number" IS NOT NULL OR c."convenio" IS NOT NULL OR c."preferred_doctor" IS NOT NULL OR c."notes" IS NOT NULL;

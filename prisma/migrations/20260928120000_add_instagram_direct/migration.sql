CREATE TYPE "contact_channel" AS ENUM ('WHATSAPP', 'INSTAGRAM');

ALTER TABLE "contacts" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "contacts" ADD COLUMN "channel" "contact_channel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "contacts" ADD COLUMN "external_id" TEXT;
ALTER TABLE "contacts" ADD COLUMN "instagram_username" TEXT;
CREATE UNIQUE INDEX "contacts_channel_external_id_key" ON "contacts"("channel", "external_id");

CREATE TABLE "instagram_accounts" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "ig_user_id" TEXT NOT NULL,
    "username" TEXT,
    "access_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "instagram_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instagram_accounts_clinic_id_key" ON "instagram_accounts"("clinic_id");
CREATE UNIQUE INDEX "instagram_accounts_ig_user_id_key" ON "instagram_accounts"("ig_user_id");
ALTER TABLE "instagram_accounts" ADD CONSTRAINT "instagram_accounts_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

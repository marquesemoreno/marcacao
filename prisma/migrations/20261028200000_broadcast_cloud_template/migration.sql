ALTER TABLE "broadcast_campaigns" ADD COLUMN "cloud_template_name" TEXT;
ALTER TABLE "broadcast_campaigns" ADD COLUMN "cloud_template_language" TEXT;
ALTER TABLE "broadcast_campaigns" ADD COLUMN "cloud_template_body" TEXT;
ALTER TABLE "broadcast_campaigns" ADD COLUMN "cloud_template_params" TEXT[] DEFAULT ARRAY[]::TEXT[];

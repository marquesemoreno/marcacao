ALTER TABLE "broadcast_campaigns" ADD COLUMN "message_variants" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "broadcast_recipients" ADD COLUMN "variant_index" INTEGER;

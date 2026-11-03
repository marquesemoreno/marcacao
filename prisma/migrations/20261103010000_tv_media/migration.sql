-- Mídia da TV da sala de espera (vídeos, propaganda, música)
CREATE TABLE "tv_media_items" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration_sec" INTEGER NOT NULL DEFAULT 15,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tv_media_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tv_media_items_clinic_id_position_idx" ON "tv_media_items"("clinic_id", "position");

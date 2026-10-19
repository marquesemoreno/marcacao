-- CreateTable
CREATE TABLE "loss_reasons" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loss_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loss_reasons_clinic_id_label_key" ON "loss_reasons"("clinic_id", "label");

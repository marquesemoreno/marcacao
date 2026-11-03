-- Cerca de localização do QR de chegada
ALTER TABLE "clinics" ADD COLUMN "arrival_lat" DOUBLE PRECISION;
ALTER TABLE "clinics" ADD COLUMN "arrival_lng" DOUBLE PRECISION;
ALTER TABLE "clinics" ADD COLUMN "arrival_radius_m" INTEGER NOT NULL DEFAULT 150;

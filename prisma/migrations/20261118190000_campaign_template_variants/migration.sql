-- Teste A/B/C: até 2 modelos aprovados a mais por campanha, sorteados por destinatário.
ALTER TABLE "broadcast_campaigns" ADD COLUMN "cloud_template_variants" JSONB NOT NULL DEFAULT '[]';

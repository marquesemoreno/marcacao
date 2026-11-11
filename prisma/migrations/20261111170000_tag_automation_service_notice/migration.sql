-- Automações: "aviso de serviço" (laudo pronto, convênio autorizou) enviado mesmo sem aceite
-- de marketing. Só acrescenta uma coluna com valor padrão em tag_automations.
-- IF NOT EXISTS: pode rodar de novo.

ALTER TABLE "tag_automations" ADD COLUMN IF NOT EXISTS "service_notice" BOOLEAN NOT NULL DEFAULT false;

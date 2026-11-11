-- Índices da auditoria de arquitetura (nov/2026). Só criam índice; não mexem em dados.
-- IF NOT EXISTS: rodar de novo não dá erro.

-- Consultado a cada mensagem recebida, pra saber se é resposta de campanha.
CREATE INDEX IF NOT EXISTS "broadcast_recipients_phone_idx" ON "broadcast_recipients"("phone");

-- A limpeza diária apaga por data; a tabela não tinha índice nenhum.
CREATE INDEX IF NOT EXISTS "webhook_logs_created_at_idx" ON "webhook_logs"("created_at");

-- Fila do Chat: ordena por última mensagem e filtra por responsável.
CREATE INDEX IF NOT EXISTS "conversations_clinic_id_last_message_at_idx" ON "conversations"("clinic_id", "last_message_at");
CREATE INDEX IF NOT EXISTS "conversations_assigned_user_id_idx" ON "conversations"("assigned_user_id");

-- O despacho de campanhas roda todo minuto filtrando por clínica e situação.
CREATE INDEX IF NOT EXISTS "broadcast_campaigns_clinic_id_status_idx" ON "broadcast_campaigns"("clinic_id", "status");

-- Histórico do paciente no Chat busca agendamentos pelo telefone.
CREATE INDEX IF NOT EXISTS "appointments_patient_phone_idx" ON "appointments"("patient_phone");

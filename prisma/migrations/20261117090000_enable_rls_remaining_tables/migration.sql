-- Segurança crítica (auditoria de 17/11/2026, achado S1).
--
-- A migration 20260915120000_enable_rls_public_tables ligou o RLS nas tabelas que
-- existiam em 15/09. As tabelas criadas depois ficaram sem — conferido no catálogo de
-- produção em 17/11: 36 tabelas com relrowsecurity = false e o papel `anon` (a chave
-- pública que vai no JavaScript do site) com SELECT, INSERT, UPDATE e DELETE em todas,
-- pela API REST do Supabase, sem login. Entre elas contact_clinic_profiles (CPF, RG,
-- endereço, convênio), instagram_accounts (token), patient_access_logs e audit_logs.
--
-- O app só fala com o banco pelo Prisma, com o papel `postgres` (dono, BYPASSRLS):
-- ligar o RLS sem policy não muda nada para ele (já é assim nas tabelas antigas) e
-- zera o acesso de `anon` / `authenticated`.
--
-- Só ALTER TABLE ... ENABLE ROW LEVEL SECURITY: não lê nem altera nenhuma linha.
-- Pode rodar de novo sem efeito. A trava src/lib/rls-migrations.guard.test.ts faz o CI
-- falhar se uma migration futura criar tabela sem ligar o RLS.

ALTER TABLE "acquisition_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agenda_marks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_action_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign_spends" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "channel_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cloud_test_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_acceptances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_clinic_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_stage_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_deletion_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "doctor_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "instagram_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_failures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loss_reasons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marcadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nps_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_access_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_data_suggestions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_form_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "queue_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "queue_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "return_intervals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "slot_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stage_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tv_displays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tv_media_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waitlist_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_cloud_accounts" ENABLE ROW LEVEL SECURITY;

-- Cópia de segurança criada à mão em 20/10 (fora das migrations), com CPF, RG e endereço.
-- Fecha aqui; apagar a tabela é decisão à parte.
ALTER TABLE IF EXISTS "contacts_sensitive_backup_20261020" ENABLE ROW LEVEL SECURITY;

-- Rede de segurança: qualquer outra tabela do schema public que tenha ficado sem RLS
-- (criada à mão, como a cópia acima).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

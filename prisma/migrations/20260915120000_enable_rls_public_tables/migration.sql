-- Segurança crítica: o Supabase expõe toda tabela do schema public via API REST
-- (PostgREST) usando a anon key — que é PÚBLICA por design (embutida no bundle do
-- navegador, NEXT_PUBLIC_SUPABASE_ANON_KEY). Sem RLS, qualquer um com essa chave
-- lia direto (confirmado com teste real): hash de senha de todo usuário, token de
-- API do bridge Firebird de cada clínica, chave da Evolution API de cada
-- instância de WhatsApp, e o conteúdo cru de webhook_logs (mensagem + telefone
-- do paciente) — tudo sem autenticação nenhuma, ignorando completamente o
-- Next.js/NextAuth.
--
-- A aplicação nunca usa PostgREST pra ler/escrever dado (só Prisma, direto no
-- Postgres, e Supabase Storage/Realtime pra mídia e broadcast) — e a conexão do
-- Prisma usa o role `postgres`, que tem BYPASSRLS (confirmado via
-- pg_roles.rolbypassrls). Ativar RLS aqui, mesmo sem nenhuma policy, não muda
-- nada pro Prisma — só derruba pra zero o acesso dos roles `anon`/`authenticated`
-- via API REST, que é exatamente o buraco que precisa fechar.
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."affiliate_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."affiliates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ai_attendant_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ai_interaction_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ai_outreach_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bridge_reminder_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."broadcast_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."broadcast_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."canned_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_automations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."clinic_procedures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."clinics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."hospital_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."partner_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."procedures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."specialties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."whatsapp_instances" ENABLE ROW LEVEL SECURITY;

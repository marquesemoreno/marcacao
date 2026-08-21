import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

/**
 * Cliente Supabase server-side com a `service_role` key — só pra operações de
 * Storage (upload de mídia recebida do WhatsApp, geração de URL assinada).
 * NUNCA importar isto num Client Component: a service_role key ignora RLS e
 * não pode vazar pro navegador (por isso `server-only`, que quebra o build
 * se algum "use client" tentar importar este arquivo).
 *
 * Retorna `null` se SUPABASE_SERVICE_ROLE_KEY não estiver configurada — quem
 * chama deve tratar como "recurso de mídia desligado", nunca lançar erro
 * (mesmo padrão de src/lib/supabase-client.ts pro Realtime).
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  cachedClient =
    url && serviceRoleKey
      ? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
      : null;
  return cachedClient;
}

export const WHATSAPP_MEDIA_BUCKET = "whatsapp-media";

/** Mesmo nome de canal usado pelo cliente em src/hooks/use-inbox-realtime.ts. */
export const INBOX_REALTIME_CHANNEL = "inbox-changes";

/**
 * Avisa (via Supabase Realtime Broadcast) que algo mudou no inbox — sem
 * carregar NENHUM dado sensível no payload, só o sinal em si. Quem escuta
 * reage refazendo a busca pela mesma Server Action de sempre (que já exige
 * sessão de clínica/admin) — o broadcast nunca é a fonte do dado, só o
 * gatilho pra buscar de novo mais rápido do que esperar o próximo poll.
 *
 * Deliberadamente NÃO usa `postgres_changes` (replicação direta das tabelas
 * messages/conversations): isso exigiria política de RLS liberando leitura
 * pra role `anon` — e a anon key fica embutida no bundle do navegador
 * (pública por design). Uma política assim deixaria qualquer pessoa com a
 * anon key escutar mensagens de TODOS os pacientes de TODAS as clínicas em
 * tempo real, um vazamento de dado de saúde (LGPD). Broadcast não depende
 * de RLS nenhuma — o payload é só o que o servidor decide mandar.
 */
export async function notifyInboxRealtime() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const channel = supabase.channel(INBOX_REALTIME_CHANNEL);
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({ type: "broadcast", event: "changed", payload: {} }).finally(resolve);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        resolve();
      }
    });
  });
  supabase.removeChannel(channel);
}

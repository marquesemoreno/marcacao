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

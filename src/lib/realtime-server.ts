import "server-only";
import { agendaTopic } from "@/lib/realtime-topic";

/** Avisa as telas da Agenda da clínica que algo mudou (Supabase Realtime Broadcast).
 * O aviso não leva dado de paciente — a tela só recarrega pelo servidor. Nunca lança:
 * se falhar, o recarregamento de 90 s cobre. */
export async function notifyAgenda(clinicId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!url || !key || !secret) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic: agendaTopic(clinicId, secret), event: "changed", payload: {} }] }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // silencioso de propósito
  }
}

/** Tópico (não adivinhável) que a tela da clínica assina. */
export function agendaTopicFor(clinicId: string): string | null {
  const secret = process.env.NEXTAUTH_SECRET;
  return secret ? agendaTopic(clinicId, secret) : null;
}

import { createHmac } from "crypto";

/** Canal de "a agenda mudou" no Supabase Realtime (Broadcast). O nome é um HMAC do id da
 * clínica — só quem recebe do servidor (sessão da clínica) sabe qual é. O canal só leva um
 * aviso sem dado de paciente; quem recebe recarrega pela action autenticada. */
export function agendaTopic(clinicId: string, secret: string): string {
  return `agenda-${createHmac("sha256", secret).update(`agenda:${clinicId}`).digest("hex").slice(0, 32)}`;
}

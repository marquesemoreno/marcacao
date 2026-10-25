import type { BroadcastChannel } from "@/lib/broadcast-channel";

type Env = Record<string, string | undefined>;

const present = (value: string | undefined) => Boolean(value && value.trim());

/** Variáveis de ambiente que faltam para o canal funcionar (lista vazia = pronto). Usada
 * para impedir o início de uma campanha sem provedor configurado e para o despachante não
 * tentar enviar. O WhatsApp tem a própria configuração (por clínica), não passa por aqui. */
export function missingChannelConfig(channel: BroadcastChannel, env: Env = process.env): string[] {
  const missing: string[] = [];
  if (channel === "SMS") {
    if (!present(env.COMTELE_API_KEY)) missing.push("COMTELE_API_KEY");
    if (!present(env.COMTELE_ROUTE) || !Number.isInteger(Number(env.COMTELE_ROUTE))) missing.push("COMTELE_ROUTE");
    if (!present(env.UNSUBSCRIBE_SECRET)) missing.push("UNSUBSCRIBE_SECRET");
  } else if (channel === "EMAIL") {
    if (!present(env.RESEND_API_KEY)) missing.push("RESEND_API_KEY");
    if (!present(env.BROADCAST_EMAIL_FROM)) missing.push("BROADCAST_EMAIL_FROM");
    if (!present(env.UNSUBSCRIBE_SECRET)) missing.push("UNSUBSCRIBE_SECRET");
  }
  return missing;
}

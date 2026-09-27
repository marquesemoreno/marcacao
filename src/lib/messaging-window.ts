/** Separado de instagram-webhook.ts (que usa node:crypto) pra poder rodar no navegador —
 * o Inbox mostra o aviso de janela com a mesma regra usada no envio. */
const HOUR = 3600000;

/** Janela da Meta pra responder DM: até 24h da última mensagem DO LEAD é livre; até 7
 * dias só com a tag HUMAN_AGENT (precisa da permissão aprovada no App Review); depois
 * disso a Meta recusa o envio. */
export function messagingWindowState(lastInboundAt: Date | null, now: Date = new Date()): "OPEN" | "HUMAN_AGENT" | "CLOSED" {
  if (!lastInboundAt) return "CLOSED";
  const elapsed = now.getTime() - lastInboundAt.getTime();
  if (elapsed <= 24 * HOUR) return "OPEN";
  if (elapsed <= 7 * 24 * HOUR) return "HUMAN_AGENT";
  return "CLOSED";
}

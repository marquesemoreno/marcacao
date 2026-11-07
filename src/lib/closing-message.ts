/** Mensagem de despedida ao finalizar (Etapa 2.2, 07/11/2026). A Santa Clara digitava a mesma
 * despedida ~160x em 60 dias, quase sempre logo antes de finalizar. Com a opção ligada, o
 * sistema manda sozinho ao finalizar. Puro e testado. */

export const DEFAULT_CLOSING_MESSAGE =
  "Espero ter resolvido sua solicitação. Caso surja alguma outra dúvida, é só nos chamar.\n\nEstamos finalizando seu atendimento.";

/** Motivos em que o paciente não está mais na conversa (ou ela segue em outro lugar). */
const SKIP_REASONS = new Set(["SEM_RESPOSTA", "INATIVIDADE", "ATENDIMENTO_CONCLUIDO", "ADMINISTRATIVO", "ATENDIDO_NO_CELULAR", "ENCAMINHADO"]);

const WINDOW_MS = 24 * 3_600_000;
const RECENT_MS = 30 * 60_000;

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
}

/** "Parecida" = começa com as mesmas 3 primeiras palavras da despedida configurada. */
function looksLikeClosing(content: string, text: string): boolean {
  const key = norm(text).split(" ").slice(0, 3).join(" ");
  return key.length > 0 && norm(content).startsWith(key);
}

export function shouldSendClosingMessage(input: {
  enabled: boolean;
  text: string | null | undefined;
  /** Caixa "Enviar despedida" do modal de finalizar. */
  requested: boolean;
  reason: string;
  lastInboundAt: Date | null;
  recentOutbound: { content: string; createdAt: Date }[];
  now: Date;
}): boolean {
  const text = input.text?.trim();
  if (!input.enabled || !text || !input.requested) return false;
  if (SKIP_REASONS.has(input.reason)) return false;
  // Fora da janela de 24 h a API oficial recusa texto livre (e o paciente sumiu).
  if (!input.lastInboundAt || input.now.getTime() - input.lastInboundAt.getTime() > WINDOW_MS) return false;
  const since = input.now.getTime() - RECENT_MS;
  return !input.recentOutbound.some((m) => m.createdAt.getTime() >= since && looksLikeClosing(m.content, text));
}

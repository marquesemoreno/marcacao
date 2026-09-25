export type ResponseTimings = {
  firstResponseSec: number | null;
  resolutionSec: number | null;
};

export type TimingMessage = { direction: "INBOUND" | "OUTBOUND"; type: string; content: string; createdAt: Date };

/** FRT (tempo até a primeira resposta) e TTR (tempo até resolver) — pura aritmética de
 * timestamp, sem IA. FRT ignora só nota interna (não é visível pro paciente) — mensagem
 * automática de sistema (ex: confirmação de agendamento) CONTA como primeira resposta,
 * já que é isso que o paciente efetivamente recebe. `null` quando não dá pra calcular
 * (ex: conversa sem nenhuma mensagem do paciente, ou ainda sem resposta nenhuma). Função
 * pura (mensagens já em mãos), sem `server-only` (ao contrário de conversation-quality.ts),
 * justamente pra poder testar sem tocar no banco — ver computeResponseTimings. */
export function computeResponseTimingsFromMessages(messages: TimingMessage[], resolvedAt: Date | null): ResponseTimings {
  const firstInbound = messages.find((m) => m.direction === "INBOUND");
  if (!firstInbound) return { firstResponseSec: null, resolutionSec: null };

  // Só conta como "resposta" uma mensagem OUTBOUND depois do primeiro INBOUND — a
  // clínica às vezes inicia a conversa (nota fiscal, lembrete) antes do paciente
  // escrever, e essa mensagem proativa não é uma resposta a nada (bug real: sem esse
  // filtro, firstResponseSec saía negativo pra toda conversa que começou assim).
  const firstRealReply = messages.find(
    (m) =>
      m.direction === "OUTBOUND" &&
      m.type !== "INTERNAL_NOTE" &&
      m.createdAt.getTime() > firstInbound.createdAt.getTime()
  );

  const firstResponseSec = firstRealReply
    ? Math.round((firstRealReply.createdAt.getTime() - firstInbound.createdAt.getTime()) / 1000)
    : null;

  const resolutionSec = resolvedAt
    ? Math.round((resolvedAt.getTime() - firstInbound.createdAt.getTime()) / 1000)
    : null;

  return { firstResponseSec, resolutionSec };
}

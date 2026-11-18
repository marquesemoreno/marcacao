import { businessHoursBetween } from "@/lib/conversation-auto-close";

/**
 * Conversa atribuída e sem resposta volta para a fila (análise do DeskcommCRM, Top 5 nº 3
 * — 18/11/2026). Ataca o paciente esquecido: a conversa fica com alguém que saiu, está
 * ocupado ou não viu, e ninguém mais pega porque "já tem dono".
 *
 * "Voltar para a fila" = tirar o dono (assignedUserId null → aba Não Atribuídas), não
 * passar para outra pessoa: a distribuição automática está desligada (pull).
 *
 * O limite de devoluções é contado pelas notas internas com QUEUE_RETURN_NOTE_PREFIX
 * desde a última resposta humana — sem coluna extra, e zera sozinho quando alguém responde.
 */

export const QUEUE_RETURN_NOTE_PREFIX = "↩️ Voltou para a fila";
export const MAX_QUEUE_RETURNS = 2;

export type QueueReturnMessage = {
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  senderUserId: string | null;
  sentFromDevice: boolean;
  content: string | null;
  createdAt: Date;
};

export type QueueReturnInput = {
  now: Date;
  /** Clinic.unansweredReturnMinutes — null/0 = desligado. */
  returnMinutes: number | null;
  assignedUserId: string | null;
  /** Conversation.assignedAt — null em atribuições antigas (conta da mensagem do paciente). */
  assignedAt: Date | null;
  status: string;
  aiEnabled: boolean;
  archivedAt: Date | null;
  /** Mensagens da conversa em ordem cronológica (as mais recentes bastam). */
  messages: QueueReturnMessage[];
};

export type QueueReturnDecision = { return: false } | { return: true; waitingMinutes: number };

/** Alguém da equipe respondeu de verdade: pelo painel (senderUserId) ou pelo celular da clínica. */
function isHumanReply(m: QueueReturnMessage): boolean {
  return m.direction === "OUTBOUND" && m.type !== "INTERNAL_NOTE" && (m.senderUserId !== null || m.sentFromDevice);
}

function afterLastHumanReply(messages: QueueReturnMessage[]): QueueReturnMessage[] {
  let lastHuman = -1;
  messages.forEach((m, i) => {
    if (isHumanReply(m)) lastHuman = i;
  });
  return messages.slice(lastHuman + 1);
}

function firstPatientMessage(messages: QueueReturnMessage[]): QueueReturnMessage | undefined {
  return messages.find((m) => m.direction === "INBOUND" && m.type !== "INTERNAL_NOTE");
}

/** Desde quando o paciente espera resposta da equipe (null = a equipe respondeu por último). */
export function waitingSince(messages: QueueReturnMessage[]): Date | null {
  return firstPatientMessage(afterLastHumanReply(messages))?.createdAt ?? null;
}

/** Painel "Esperando": quem espera resposta (mais antigo primeiro, com ou sem dono) e quem
 * está em atendimento (tem dono e a equipe falou por último). */
export function groupWaitingBoard<T extends { assignedUserId: string | null; waitingSince: Date | null }>(rows: T[]) {
  const waiting = rows
    .filter((r) => r.waitingSince)
    .sort((a, b) => a.waitingSince!.getTime() - b.waitingSince!.getTime());
  const inService = rows.filter((r) => !r.waitingSince && r.assignedUserId);
  return { waiting, inService };
}

export function decideQueueReturn(input: QueueReturnInput): QueueReturnDecision {
  const no = { return: false } as const;
  if (!input.returnMinutes || input.returnMinutes <= 0) return no;
  if (!input.assignedUserId || input.aiEnabled || input.archivedAt) return no;
  if (input.status !== "OPEN" && input.status !== "PENDING") return no;

  const after = afterLastHumanReply(input.messages);
  const firstUnanswered = firstPatientMessage(after);
  if (!firstUnanswered) return no;

  const returns = after.filter((m) => m.type === "INTERNAL_NOTE" && m.content?.startsWith(QUEUE_RETURN_NOTE_PREFIX)).length;
  if (returns >= MAX_QUEUE_RETURNS) return no;

  const start =
    input.assignedAt && input.assignedAt > firstUnanswered.createdAt ? input.assignedAt : firstUnanswered.createdAt;
  const waitingMinutes = Math.floor(businessHoursBetween(start, input.now) * 60 + 1e-6);
  if (waitingMinutes < input.returnMinutes) return no;
  return { return: true, waitingMinutes };
}

/** Prazos que a gestão pode escolher em /clinic/esperando (minutos úteis). */
export const RETURN_MINUTE_OPTIONS = [15, 30, 60, 120] as const;

export function queueReturnNote(assigneeName: string, waitingMinutes: number): string {
  return `${QUEUE_RETURN_NOTE_PREFIX}: ${assigneeName} não respondeu em ${waitingMinutes} min. Qualquer pessoa da equipe pode assumir.`;
}

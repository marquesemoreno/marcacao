/**
 * Recuperação de ligação perdida (docs/analise-deskcomm-ligacoes.md, docs/analise-deskvoice.md
 * — 18/11/2026). Quem ligou pelo WhatsApp e ninguém atendeu recebe uma mensagem convidando a
 * escrever; quando a mensagem não pode sair, a recepção ganha uma tarefa para retornar.
 *
 * Só regras puras aqui (testadas); quem grava, envia e cria a tarefa é missed-call-server.ts.
 */

import { NON_PATIENT_TAG, WRONG_NUMBER_TAG } from "@/lib/conversation-tags";
import { isNationalHolidayYMD } from "@/lib/holidays";

/** Aviso de chamada da Evolution (evento CALL, objeto de chamada do Baileys). */
export type CallStatusEvent = { status: string; at: Date };

export type CallOutcome = "PENDING" | "MISSED" | "ANSWERED" | "UNKNOWN";

/** Tempo de toque do WhatsApp antes do "timeout" fica em torno de 45–60 s: terminar antes
 * disso sem "accept" é quem ligou desistindo. Depois disso, sem "accept", pode ter sido
 * atendida no celular sem o aviso chegar aos aparelhos conectados — na dúvida, não manda. */
export const RING_LIMIT_SECONDS = 60;
/** Sem aviso de fim depois disso, o aviso se perdeu: não dá para afirmar que foi perdida. */
export const CALL_SETTLE_SECONDS = 180;

export function callOutcome(events: CallStatusEvent[], now: Date): CallOutcome {
  if (events.some((e) => e.status === "accept")) return "ANSWERED";
  if (events.some((e) => e.status === "timeout" || e.status === "reject")) return "MISSED";
  const start = Math.min(...events.map((e) => e.at.getTime()));
  const end = events.find((e) => e.status === "terminate");
  if (end) return end.at.getTime() - start < RING_LIMIT_SECONDS * 1000 ? "MISSED" : "UNKNOWN";
  return now.getTime() - start >= CALL_SETTLE_SECONDS * 1000 ? "UNKNOWN" : "PENDING";
}

/** Em horário comercial espera um pouco: a própria pessoa liga de novo, ou a recepção retorna. */
export const RECOVERY_WAIT_MINUTES = 2;

export type MissedCallRecoveryInput = {
  now: Date;
  /** Quando a ligação terminou sem ser atendida. */
  missedAt: Date;
  /** Clinic.missedCallRecoveryEnabled. */
  enabled: boolean;
  /** Telefone de quem ligou; null quando o WhatsApp escondeu o número (@lid). */
  phone: string | null;
  /** Clínica aberta agora (08–18h seg–sáb, sem feriado). */
  open: boolean;
  /** Tags da conversa desse número, se houver. */
  tags: string[];
  /** Número de alguém da equipe ou de outra clínica da casa. */
  isTeamNumber: boolean;
  /** O mesmo número ligou de novo e foi atendido, ou a recepção ligou e foi atendida. */
  answeredLater: boolean;
  /** Última resposta da equipe (humana) na conversa desse número. */
  lastTeamReplyAt: Date | null;
  /** Última mensagem de recuperação mandada para esse número. */
  lastRecoveryToNumberAt: Date | null;
  /** Recuperações mandadas pela clínica na última hora / hoje (Brasília). */
  clinicSentLastHour: number;
  clinicSentToday: number;
  /** Já existe tarefa aberta de retornar esse número. */
  openTaskForNumber: boolean;
  /** Envios automáticos pausados na clínica (número restrito). */
  paused: boolean;
};

export type MissedCallRecoveryDecision =
  | { action: "WAIT"; until: Date }
  | { action: "SEND" }
  | { action: "TASK"; reason: string }
  | { action: "SKIP"; reason: string };

/** A equipe respondeu a conversa há menos que isso: já estão falando, não manda. */
export const RECENT_REPLY_MINUTES = 30;
/** No máximo uma recuperação por número nesse intervalo (várias tentativas = uma ligação). */
export const PER_NUMBER_HOURS = 24;
/** Tetos por clínica (decisão do usuário, 18/11/2026): protegem o número contra rajada.
 * Passou do teto, a mensagem não sai e a recepção recebe a tarefa de retornar. */
export const MAX_PER_HOUR = 3;
export const MAX_PER_DAY = 20;

export function decideMissedCallRecovery(i: MissedCallRecoveryInput): MissedCallRecoveryDecision {
  if (!i.enabled) return { action: "SKIP", reason: "DESLIGADO" };
  if (!i.phone) return { action: "SKIP", reason: "NUMERO_OCULTO" };
  if (i.tags.includes(NON_PATIENT_TAG)) return { action: "SKIP", reason: "NAO_PACIENTE" };
  if (i.tags.includes(WRONG_NUMBER_TAG)) return { action: "SKIP", reason: "NUMERO_ERRADO" };
  if (i.isTeamNumber) return { action: "SKIP", reason: "EQUIPE" };
  const until = new Date(i.missedAt.getTime() + RECOVERY_WAIT_MINUTES * 60_000);
  if (i.open && i.now < until) return { action: "WAIT", until };
  if (i.answeredLater) return { action: "SKIP", reason: "ATENDIDA_DEPOIS" };
  if (i.lastTeamReplyAt && i.now.getTime() - i.lastTeamReplyAt.getTime() < RECENT_REPLY_MINUTES * 60_000) {
    return { action: "SKIP", reason: "CONVERSA_RECENTE" };
  }
  if (i.lastRecoveryToNumberAt && i.now.getTime() - i.lastRecoveryToNumberAt.getTime() < PER_NUMBER_HOURS * 3600_000) {
    return { action: "SKIP", reason: "JA_ENVIADO_24H" };
  }
  const taskOnly = i.paused
    ? "PAUSADO"
    : i.clinicSentLastHour >= MAX_PER_HOUR
      ? "TETO_HORA"
      : i.clinicSentToday >= MAX_PER_DAY
        ? "TETO_DIA"
        : null;
  if (taskOnly) return i.openTaskForNumber ? { action: "SKIP", reason: "TAREFA_ABERTA" } : { action: "TASK", reason: taskOnly };
  return { action: "SEND" };
}

/** Texto da recuperação (decisão do usuário, 18/11/2026: convida a responder). Nunca nomeia
 * doença, exame ou procedimento. Nome só quando o número é confiável (WhatsApp): número de
 * telefone comum pode ser forjado, e o nome entregaria a um estranho que a pessoa é paciente. */
export function missedCallText(i: { firstName: string | null; trustedNumber: boolean; clinicName: string; open: boolean }): string {
  const greeting = i.trustedNumber && i.firstName ? `Oi, ${i.firstName}` : "Olá";
  return i.open
    ? `${greeting}! Vimos sua ligação para a ${i.clinicName} e não conseguimos atender agora. Como podemos ajudar? Pode responder por aqui que já falamos com você.`
    : `${greeting}! Recebemos sua ligação para a ${i.clinicName}, mas estamos fora do horário de atendimento. Deixe sua mensagem por aqui e retornamos assim que abrirmos.`;
}

export type ParsedCallEvent = { callId: string; status: string; at: Date; phone: string | null; isVideo: boolean };

function phoneFromJid(jid: unknown): string | null {
  if (typeof jid !== "string" || !jid.endsWith("@s.whatsapp.net")) return null;
  const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

/** Objeto de chamada do Baileys que a Evolution manda no evento CALL. Chamada de grupo fica
 * de fora. Com o número escondido (@lid), vale o telefone real quando vem junto (callerPn). */
export function parseCallEvent(raw: unknown): ParsedCallEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id || typeof r.status !== "string" || r.isGroup === true) return null;
  const parsed = typeof r.date === "string" || typeof r.date === "number" ? new Date(r.date) : null;
  return {
    callId: r.id,
    status: r.status,
    at: parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(),
    phone: phoneFromJid(r.from) ?? phoneFromJid(r.callerPn),
    isVideo: r.isVideo === true,
  };
}

const BRASILIA_OFFSET_MS = 3 * 3600_000;

/** Meia-noite de Brasília (UTC-3 fixo) do dia de `now` — conta o teto do dia. */
export function brasiliaDayStart(now: Date): Date {
  const local = now.getTime() - BRASILIA_OFFSET_MS;
  return new Date(Math.floor(local / 86_400_000) * 86_400_000 + BRASILIA_OFFSET_MS);
}

/** Clínica aberta para a recuperação: 08–18h de Brasília, segunda a sábado, sem feriado
 * nacional (mesma janela dos lembretes). Fora disso vai o texto de "fora do horário". */
export function isRecoveryOpen(now: Date): boolean {
  const local = new Date(now.getTime() - BRASILIA_OFFSET_MS);
  if (local.getUTCDay() === 0) return false;
  if (isNationalHolidayYMD(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate())) return false;
  const hour = local.getUTCHours();
  return hour >= 8 && hour < 18;
}

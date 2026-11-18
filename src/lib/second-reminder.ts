import { greetingFirstName } from "@/lib/format";

/**
 * 2º lembrete no dia da consulta, só para quem NÃO respondeu ao lembrete D-1
 * (análise do DeskcommCRM, Top 5 nº 2 — 18/11/2026). Ataca faltas sem mandar
 * mensagem a mais para quem já confirmou, cancelou ou pediu para remarcar.
 *
 * Fica na MESMA linha do BridgeReminderLog do D-1 (campo secondSentAt): a resposta
 * do paciente a qualquer um dos dois avisos cai no mesmo `response`, então o
 * relatório de Confirmações não muda.
 */

const BRAZIL_OFFSET_MS = 3 * 3_600_000;
/** Nunca antes disso, mesmo com consulta cedo (a janela geral dos lembretes já é 08–18h). */
const EARLIEST_LOCAL_HOUR = 7;

export type SecondReminderDueInput = {
  now: Date;
  /** Dia do agendamento "AAAA-MM-DD" (agenda do bridge). */
  appointmentDateIso: string;
  /** Horário vindo do Firebird ("14:00" ou "14:00:00"); null = sem horário marcado. */
  appointmentTime: string | null;
  /** HospitalIntegration.secondReminderHours — null/0 = desligado. */
  hoursBefore: number | null;
  /** BridgeReminderLog.response do D-1 (null = não respondeu). */
  d1Response: string | null;
  /** BridgeReminderLog.secondSentAt (null = 2º ainda não saiu). */
  secondSentAt: Date | null;
};

export function secondReminderDue(input: SecondReminderDueInput): boolean {
  if (!input.hoursBefore || input.hoursBefore <= 0) return false;
  if (input.d1Response || input.secondSentAt) return false;
  const time = input.appointmentTime?.match(/^(\d{1,2}):(\d{2})/);
  if (!time) return false;

  // Relógio "de parede" de Brasília em UTC, pra comparar sem depender do fuso do servidor.
  const local = new Date(input.now.getTime() - BRAZIL_OFFSET_MS);
  const todayIso = local.toISOString().slice(0, 10);
  if (todayIso !== input.appointmentDateIso) return false;
  if (local.getUTCHours() < EARLIEST_LOCAL_HOUR) return false;

  const [y, m, d] = input.appointmentDateIso.split("-").map(Number);
  const appointmentLocal = Date.UTC(y, m - 1, d, Number(time[1]), Number(time[2]));
  const nowLocal = local.getTime();
  if (nowLocal >= appointmentLocal) return false;
  return nowLocal >= appointmentLocal - input.hoursBefore * 3_600_000;
}

export type SecondReminderMessageInput = {
  patientName: string;
  clinicName: string;
  time: string;
  /** Preenchido quando o aviso vai para o responsável de um menor (reminder-recipient.ts). */
  guardianFirstName?: string | null;
};

/** Curto e sem procedimento/médico. Usa o mesmo menu 1/2/3 do D-1 — o webhook reconhece
 * pelo marcador "Digite 1 para Confirmar presença" (appointment-reply.ts). */
export function buildSecondReminderMessage(input: SecondReminderMessageInput): string {
  const time = input.time.slice(0, 5);
  const patientFirst = greetingFirstName(input.patientName);
  const intro = input.guardianFirstName
    ? `Oi, *${input.guardianFirstName}*! Lembrando do horário de *${patientFirst || "seu dependente"}* hoje às ${time} na ${input.clinicName}.`
    : `Oi, *${patientFirst || "tudo bem"}*! Lembrando do seu horário hoje às ${time} na ${input.clinicName}.`;
  return `${intro}

Por favor, responda com o número da opção desejada:
1️⃣ Digite 1 para Confirmar presença
2️⃣ Digite 2 para Remarcar
3️⃣ Digite 3 para Cancelar`;
}

/** Linha do tempo única da ficha do paciente (N1) — junta fontes que hoje ficam
 * espalhadas: primeiro contato, mudanças de etapa (com autor), notas do sistema/equipe,
 * campanhas, lembretes do bridge e respostas, agendamentos e finalização. Puro. */

export type TimelineKind = "first_contact" | "stage" | "note" | "broadcast" | "reminder" | "appointment" | "resolved";
export type TimelineEvent = { kind: TimelineKind; at: Date; title: string; detail?: string; author?: string };

const STAGE_LABELS: Record<string, string> = { NOVOS: "Novo", TRIAGEM: "Em atendimento", ORCAMENTO: "Orçamento", AGENDADO: "Agendado" };
const REMINDER_LABELS: Record<string, string> = { CONFIRMED: "confirmou", CANCELLED: "cancelou", RESCHEDULE: "pediu para remarcar" };
const APPOINTMENT_STATUS: Record<string, string> = {
  PENDING: "agendado",
  CONFIRMED: "confirmado",
  COMPLETED: "realizado",
  CANCELLED: "cancelado",
  NO_SHOW: "faltou",
};
const BROADCAST_STATUS: Record<string, string> = { SENT: "enviada", FAILED: "falhou", SKIPPED_OPT_OUT: "não enviada (pediu para sair)", PENDING: "na fila" };
export const RESOLUTION_LABELS: Record<string, string> = {
  AGENDAMENTO_CONCLUIDO: "Agendamento concluído",
  CONFIRMACAO_AGENDA: "Confirmação de agenda",
  AGENDAMENTO_REMARCADO: "Remarcado",
  DUVIDA_ESCLARECIDA: "Dúvida esclarecida",
  SEM_RETORNO: "Sem retorno do paciente",
  ATENDIDO_NO_CELULAR: "Atendido pelo celular",
};

export function buildPatientTimeline(input: {
  conversationCreatedAt: Date;
  acquisitionChannel?: string | null;
  stageChanges?: { at: Date; from: string; to: string; author: string | null }[];
  notes?: { at: Date; content: string; author?: string | null }[];
  broadcasts?: { at: Date; campaign: string; status: string }[];
  reminders?: { at: Date; response: string | null }[];
  appointments?: { at: Date; procedure: string; date: string; status: string }[];
  resolved?: { at: Date; reason: string | null } | null;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      kind: "first_contact",
      at: input.conversationCreatedAt,
      title: "Primeiro contato",
      ...(input.acquisitionChannel ? { detail: `Origem: ${input.acquisitionChannel}` } : {}),
    },
  ];
  for (const s of input.stageChanges ?? []) {
    events.push({
      kind: "stage",
      at: s.at,
      title: `Etapa: ${STAGE_LABELS[s.from] ?? s.from} → ${STAGE_LABELS[s.to] ?? s.to}`,
      author: s.author ?? "Automático",
    });
  }
  for (const n of input.notes ?? []) {
    events.push({ kind: "note", at: n.at, title: n.content.length > 140 ? `${n.content.slice(0, 137)}…` : n.content, ...(n.author ? { author: n.author } : {}) });
  }
  for (const b of input.broadcasts ?? []) {
    events.push({ kind: "broadcast", at: b.at, title: `Campanha "${b.campaign}"`, detail: BROADCAST_STATUS[b.status] ?? b.status });
  }
  for (const r of input.reminders ?? []) {
    events.push({
      kind: "reminder",
      at: r.at,
      title: r.response ? `Lembrete de consulta: ${REMINDER_LABELS[r.response] ?? r.response}` : "Lembrete de consulta enviado",
    });
  }
  for (const a of input.appointments ?? []) {
    events.push({ kind: "appointment", at: a.at, title: `Agendamento: ${a.procedure}`, detail: `${a.date} · ${APPOINTMENT_STATUS[a.status] ?? a.status}` });
  }
  if (input.resolved) {
    events.push({
      kind: "resolved",
      at: input.resolved.at,
      title: "Atendimento finalizado",
      ...(input.resolved.reason ? { detail: RESOLUTION_LABELS[input.resolved.reason] ?? input.resolved.reason } : {}),
    });
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

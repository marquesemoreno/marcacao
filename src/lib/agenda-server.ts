import "server-only";
import { prisma } from "@/lib/prisma";
import { extractBridgeNumeroFromNotes, fetchBridgeDailyAgendaOrNull } from "@/lib/hospital-bridge";
import { addDays, mergeAgenda, resolveAgendaStatus, type AgendaItem } from "@/lib/agenda";

const MAX_DAYS = 42;

export type AgendaResult = {
  items: AgendaItem[];
  /** Clínica tem ponte com o sistema dela (Firebird). */
  hasBridge: boolean;
  /** Dias em que não deu pra ler a ponte (computador da clínica fora do ar). */
  bridgeFailedDays: string[];
};

/** Miolo do getAgenda, sem checar sessão — quem chama já checou (ex.: tela do médico). */
export async function loadAgenda(clinicId: string, from: string, to: string): Promise<AgendaResult> {
  const days: string[] = [];
  for (let d = from; d <= to && days.length < MAX_DAYS; d = addDays(d, 1)) days.push(d);
  if (days.length === 0) return { items: [], hasBridge: false, bridgeFailedDays: [] };
  const fromDate = new Date(`${days[0]}T00:00:00Z`);
  const toDate = new Date(`${days[days.length - 1]}T00:00:00Z`);

  const integration = await prisma.hospitalIntegration.findUnique({ where: { clinicId }, select: { active: true } });
  const hasBridge = !!integration?.active;

  // Ponte: um pedido por dia, 7 de cada vez (roda no computador da clínica).
  const bridgeByDay = new Map<string, Awaited<ReturnType<typeof fetchBridgeDailyAgendaOrNull>>>();
  if (hasBridge) {
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      const results = await Promise.all(chunk.map((d) => fetchBridgeDailyAgendaOrNull(clinicId, d)));
      chunk.forEach((d, j) => bridgeByDay.set(d, results[j]));
    }
  }

  const [appointments, marks] = await Promise.all([
    prisma.appointment.findMany({
      where: { clinicProcedure: { clinicId }, date: { gte: fromDate, lte: toDate } },
      select: {
        id: true,
        patientName: true,
        patientPhone: true,
        date: true,
        timeSlot: true,
        status: true,
        notes: true,
        doctorName: true,
        reminderStatus: true,
        clinicProcedure: { select: { procedure: { select: { name: true } } } },
      },
    }),
    prisma.agendaMark.findMany({ where: { clinicId, date: { gte: fromDate, lte: toDate } } }),
  ]);
  const markOf = new Map(marks.map((m) => [`${m.source}:${m.externalId}`, m.status]));
  // Hora em que a recepção marcou "Chegou" (o último update da marcação IN_SERVICE).
  const arrivedOf = new Map(
    marks.filter((m) => m.status === "IN_SERVICE").map((m) => [`${m.source}:${m.externalId}`, m.updatedAt.toISOString()])
  );

  const numeros = [...bridgeByDay.values()].flatMap((list) => (list ?? []).map((a) => a.numero));
  const reminders = numeros.length
    ? await prisma.bridgeReminderLog.findMany({
        where: { clinicId, bridgeNumero: { in: numeros } },
        orderBy: { sentAt: "desc" },
        select: { bridgeNumero: true, response: true },
      })
    : [];
  const reminderOf = new Map<number, { response: string | null }>();
  for (const r of reminders) if (!reminderOf.has(r.bridgeNumero)) reminderOf.set(r.bridgeNumero, r);

  const bridgeItems: AgendaItem[] = [];
  const bridgeFailedDays: string[] = [];
  for (const [day, list] of bridgeByDay) {
    if (!list) {
      bridgeFailedDays.push(day);
      continue;
    }
    for (const a of list) {
      const reminder = reminderOf.get(a.numero);
      bridgeItems.push({
        key: `bridge:${a.numero}`,
        source: "BRIDGE",
        externalId: String(a.numero),
        date: day,
        time: a.hora,
        patientName: a.paciente,
        phone: a.telefone || null,
        procedure: a.procedimento,
        doctor: a.medico,
        bridgeNumero: a.numero,
        isManual: markOf.has(`BRIDGE:${a.numero}`),
        arrivedAt: arrivedOf.get(`BRIDGE:${a.numero}`),
        status: resolveAgendaStatus({
          manual: markOf.get(`BRIDGE:${a.numero}`),
          reminderResponse: reminder?.response,
          reminderSent: !!reminder,
        }),
      });
    }
  }

  const localItems: AgendaItem[] = appointments.map((a) => ({
    key: `local:${a.id}`,
    source: "LOCAL",
    externalId: a.id,
    date: a.date.toISOString().slice(0, 10),
    time: a.timeSlot,
    patientName: a.patientName,
    phone: a.patientPhone || null,
    procedure: a.clinicProcedure.procedure.name,
    doctor: a.doctorName,
    bridgeNumero: extractBridgeNumeroFromNotes(a.notes),
    isManual: markOf.has(`LOCAL:${a.id}`),
    arrivedAt: arrivedOf.get(`LOCAL:${a.id}`),
    status: resolveAgendaStatus({
      manual: markOf.get(`LOCAL:${a.id}`),
      local: a.status,
      reminderResponse:
        a.reminderStatus === "CONFIRMED" ? "CONFIRMED" : a.reminderStatus === "RESCHEDULE_REQUESTED" ? "RESCHEDULE" : null,
      reminderSent: a.reminderStatus === "SENT",
    }),
  }));

  const items = mergeAgenda(bridgeItems, localItems);
  // Ficha prévia enviada (jornada do paciente): selo no cartão. Falha aqui não derruba a agenda.
  const formDone = await prisma.patientFormResponse
    .findMany({
      where: { clinicId, appointmentDate: { gte: fromDate, lte: toDate } },
      select: { appointmentSource: true, appointmentExternalId: true },
    })
    .then((rows) => new Set(rows.map((r) => `${r.appointmentSource}:${r.appointmentExternalId}`)))
    .catch(() => new Set<string>());
  for (const i of items) if (formDone.has(`${i.source}:${i.externalId}`)) i.formDone = true;
  return { items, hasBridge, bridgeFailedDays: bridgeFailedDays.sort() };
}


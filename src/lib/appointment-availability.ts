import "server-only";
import { prisma } from "@/lib/prisma";
import type { BusinessHoursMap, BusinessDayConfig } from "@/lib/business-hours";

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

const DEFAULT_BUSINESS_HOURS: BusinessHoursMap = {
  seg: { open: "08:00", close: "18:00" },
  ter: { open: "08:00", close: "18:00" },
  qua: { open: "08:00", close: "18:00" },
  qui: { open: "08:00", close: "18:00" },
  sex: { open: "08:00", close: "18:00" },
  sab: { open: "08:00", close: "12:00" },
  dom: { closed: true },
};

/** Duração fixa de 30 min por vaga — não existe campo de duração de consulta em
 * nenhum model (Procedure/ClinicProcedure) nem cadastro de médico com agenda
 * própria. v1: todo procedimento usa o mesmo grão de horário; se uma clínica
 * precisar de duração configurável por procedimento, ajustar aqui. */
const SLOT_MINUTES = 30;

function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function getDayConfig(businessHours: BusinessHoursMap, date: Date): BusinessDayConfig {
  const dayKey = DAY_KEYS[date.getUTCDay()];
  return businessHours[dayKey] || DEFAULT_BUSINESS_HOURS[dayKey] || { closed: true };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function generateDaySlots(open: string, close: string, period?: "morning" | "afternoon"): string[] {
  let start = toMinutes(open);
  let end = toMinutes(close);
  if (period === "morning") end = Math.min(end, toMinutes("12:00"));
  if (period === "afternoon") start = Math.max(start, toMinutes("12:00"));

  const slots: string[] = [];
  for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
    slots.push(toHHMM(t));
  }
  return slots;
}

export type AvailabilityResult = {
  date: string;
  doctorName?: string;
  closed: boolean;
  slots: string[];
};

/** Cruza a janela de horário comercial da clínica (mesmo formato de
 * business-hours.ts) com os agendamentos já existentes (status PENDING/CONFIRMED)
 * pra devolver as vagas livres de uma data. Só cobre clínicas do marketplace
 * (sem integração Bridge) — ver consultarHorariosDisponiveis em ai-tools.ts pra
 * clínicas com Firebird, que não tem esse conceito de vaga livre calculada. */
export async function getAvailableSlots(
  clinicId: string,
  date: string,
  opts: { doctorName?: string; period?: "morning" | "afternoon" } = {}
): Promise<AvailabilityResult> {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { businessHours: true } });
  const businessHours = (clinic?.businessHours as BusinessHoursMap | null) ?? DEFAULT_BUSINESS_HOURS;

  const parsedDate = parseDateOnly(date);
  const dayConfig = getDayConfig(businessHours, parsedDate);
  if (dayConfig.closed || !dayConfig.open || !dayConfig.close) {
    return { date, doctorName: opts.doctorName, closed: true, slots: [] };
  }

  const allSlots = generateDaySlots(dayConfig.open, dayConfig.close, opts.period);

  const occupied = await prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      date: parsedDate,
      status: { in: ["PENDING", "CONFIRMED"] },
      timeSlot: { not: null },
      ...(opts.doctorName ? { doctorName: { equals: opts.doctorName, mode: "insensitive" } } : {}),
    },
    select: { timeSlot: true },
  });
  const occupiedSet = new Set(occupied.map((o) => o.timeSlot));

  return {
    date,
    doctorName: opts.doctorName,
    closed: false,
    slots: allSlots.filter((s) => !occupiedSet.has(s)),
  };
}

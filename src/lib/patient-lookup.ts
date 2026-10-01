import "server-only";
import { prisma } from "@/lib/prisma";

export type AppointmentMatch = {
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  patientCpf: string;
  date: string;
  timeSlot: string | null;
  status: string;
  procedureName: string;
  doctorName: string | null;
};

/** Busca um agendamento ativo por nome, telefone ou CPF do paciente. `Appointment`
 * guarda esses dados direto (sem FK pra `Contact`), em formatos diferentes do resto
 * do app: `patientPhone` SEM o DDI 55 (10-11 dígitos, ver createAppointmentSchema)
 * e `patientCpf` em dígitos puros. Telefone (11 dígitos com DDD+9) e CPF (11
 * dígitos) podem ter o mesmo tamanho — não tenta adivinhar qual é qual, casa
 * contra os dois ao mesmo tempo; a recepcionista confirma visualmente qual
 * registro é o certo antes de qualquer cancelamento. */
export async function findAppointmentsByIdentifier(
  clinicId: string,
  identifier: string,
  dateStr?: string
): Promise<AppointmentMatch[]> {
  const trimmed = identifier.trim();
  const digits = trimmed.replace(/\D/g, "");
  const phoneDigits = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;

  const orConditions: Array<Record<string, unknown>> = [];
  if (trimmed.length >= 3) orConditions.push({ patientName: { contains: trimmed, mode: "insensitive" } });
  if (phoneDigits.length >= 8) orConditions.push({ patientPhone: { contains: phoneDigits } });
  if (digits.length === 11) orConditions.push({ patientCpf: digits });
  if (orConditions.length === 0) return [];

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      status: { in: ["PENDING", "CONFIRMED"] },
      ...(dateStr ? { date: new Date(`${dateStr}T00:00:00Z`) } : {}),
      OR: orConditions,
    },
    include: { clinicProcedure: { include: { procedure: true } } },
    orderBy: { date: "asc" },
    take: 5,
  });

  return appointments.map((a) => ({
    appointmentId: a.id,
    patientName: a.patientName,
    patientPhone: a.patientPhone,
    patientCpf: a.patientCpf,
    date: a.date.toISOString().slice(0, 10),
    timeSlot: a.timeSlot,
    status: a.status,
    procedureName: a.clinicProcedure.procedure.name,
    doctorName: a.doctorName,
  }));
}

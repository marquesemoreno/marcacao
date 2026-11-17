import { prisma } from "@/lib/prisma";
import { guideLinkExpired, readGuideLinkId } from "@/lib/guide-link";
import { toPublicClinic } from "@/lib/public-clinic";

/** Leitura para as páginas públicas /comprovante/[id] e /acompanhar/[id]. Fica em lib, e não
 * em src/actions/appointments.ts, de propósito: qualquer export de um arquivo "use server"
 * vira endpoint chamável sem sessão.
 *
 * Auditoria de segurança 16/11/2026: o parâmetro é o link assinado (guide-link.ts, M11) — id
 * puro não abre mais — e a clínica sai só com os campos públicos (M12). */
export async function getAppointmentByGuideLink(param: string) {
  const id = readGuideLinkId(param);
  if (!id) return { state: "INVALID" as const };
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
  if (!appointment) return { state: "INVALID" as const };
  if (guideLinkExpired(appointment.date)) return { state: "EXPIRED" as const };
  return {
    state: "OK" as const,
    appointment: {
      ...appointment,
      clinicProcedure: { ...appointment.clinicProcedure, clinic: toPublicClinic(appointment.clinicProcedure.clinic) },
    },
  };
}

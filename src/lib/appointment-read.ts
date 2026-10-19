import { prisma } from "@/lib/prisma";

/** Leitura por id para as páginas públicas /comprovante/[id] e /acompanhar/[id] (o id é o
 * "link secreto" do paciente). Fica em lib, e não em src/actions/appointments.ts, de
 * propósito: qualquer export de um arquivo "use server" vira endpoint chamável sem sessão. */
export async function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
}

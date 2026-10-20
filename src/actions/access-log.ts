"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicManager } from "@/lib/session";
import { accessActionLabel } from "@/lib/access-log";

/** Registro de acessos a dados de paciente da clínica (só gestão). Filtra por nome ou
 * telefone do paciente e por usuário; últimos `limit` registros. */
export async function listPatientAccess(params: { q?: string; userId?: string; limit?: number }) {
  const { clinicId } = await requireClinicManager();
  const q = params.q?.trim();
  const digits = q?.replace(/\D/g, "") ?? "";
  const conversationIds = q
    ? (
        await prisma.conversation.findMany({
          where: {
            clinicId,
            contact: { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] },
          },
          select: { id: true },
          take: 200,
        })
      ).map((c) => c.id)
    : null;
  const logs = await prisma.patientAccessLog.findMany({
    where: { clinicId, ...(conversationIds ? { conversationId: { in: conversationIds } } : {}), ...(params.userId ? { userId: params.userId } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 300, 1000),
  });
  const [users, convs] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.userId))] } }, select: { id: true, name: true } }),
    prisma.conversation.findMany({
      where: { id: { in: [...new Set(logs.map((l) => l.conversationId))] } },
      select: { id: true, contact: { select: { name: true, phone: true } } },
    }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const patient = new Map(convs.map((c) => [c.id, c.contact]));
  return logs.map((l) => ({
    id: l.id,
    at: l.createdAt.toISOString(),
    user: userName.get(l.userId) ?? "—",
    patient: patient.get(l.conversationId)?.name ?? "—",
    phone: patient.get(l.conversationId)?.phone ?? null,
    conversationId: l.conversationId,
    action: accessActionLabel(l.action),
  }));
}

export async function listClinicUsersForAccess() {
  const { clinicId } = await requireClinicManager();
  return prisma.user.findMany({ where: { clinicId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

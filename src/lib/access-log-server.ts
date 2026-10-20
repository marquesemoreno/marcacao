import "server-only";
import { prisma } from "@/lib/prisma";
import { READ_DEDUPE_MIN, shouldRecordAccess, type AccessAction } from "@/lib/access-log";

/** Grava o acesso (nunca quebra a tela se falhar). */
export async function recordPatientAccess(input: { clinicId: string; userId: string; conversationId: string; action: AccessAction }) {
  try {
    const last =
      input.action === "EDITOU_CADASTRO"
        ? null
        : await prisma.patientAccessLog.findFirst({
            where: {
              conversationId: input.conversationId,
              userId: input.userId,
              action: input.action,
              createdAt: { gte: new Date(Date.now() - READ_DEDUPE_MIN * 60_000) },
            },
            select: { createdAt: true },
          });
    if (!shouldRecordAccess(input.action, last?.createdAt ?? null)) return;
    await prisma.patientAccessLog.create({ data: input });
  } catch (error) {
    console.error("Falha ao registrar acesso ao paciente:", error);
  }
}

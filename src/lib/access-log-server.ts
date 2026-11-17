import { errorSummary } from "@/lib/safe-error";
import "server-only";
import { prisma } from "@/lib/prisma";
import { BULK_ACCESS_ENTITY, READ_DEDUPE_MIN, shouldRecordAccess, type AccessAction, type BulkAccessAction } from "@/lib/access-log";

/** Grava o acesso (nunca quebra a tela se falhar). */
export async function recordPatientAccess(input: { clinicId: string; userId: string; conversationId: string; action: AccessAction }) {
  try {
    const last =
      input.action === "EDITOU_CADASTRO" || input.action === "SUPORTE_EDITOU_CADASTRO"
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
    console.error("Falha ao registrar acesso ao paciente:", errorSummary(error));
  }
}

/** Acesso em lote (lista de pacientes com CPF/convênio, busca): 1 registro por usuário e
 * tipo a cada READ_DEDUPE_MIN, com a quantidade de pacientes. Nunca quebra a tela. */
export async function recordBulkAccess(input: { clinicId: string; userId: string; action: BulkAccessAction; count: number }) {
  if (input.count <= 0) return;
  try {
    const recent = await prisma.auditLog.findFirst({
      where: {
        clinicId: input.clinicId,
        userId: input.userId,
        action: input.action,
        entity: BULK_ACCESS_ENTITY,
        createdAt: { gte: new Date(Date.now() - READ_DEDUPE_MIN * 60_000) },
      },
      select: { id: true },
    });
    if (recent) return;
    await prisma.auditLog.create({
      data: { clinicId: input.clinicId, userId: input.userId, action: input.action, entity: BULK_ACCESS_ENTITY, entityId: input.clinicId, changes: { count: input.count } },
    });
  } catch (error) {
    console.error("Falha ao registrar acesso em lote:", errorSummary(error));
  }
}

/** Leitura feita pela equipe TIVDC no painel admin: acha a clínica da conversa e registra
 * como acesso do suporte (aparece em Acessos da clínica). */
export async function recordSupportAccess(userId: string, conversationId: string, action: "SUPORTE_ABRIU_CONVERSA" | "SUPORTE_EDITOU_CADASTRO" = "SUPORTE_ABRIU_CONVERSA") {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { clinicId: true } });
    if (conversation) await recordPatientAccess({ clinicId: conversation.clinicId, userId, conversationId, action });
  } catch (error) {
    console.error("Falha ao registrar acesso do suporte:", errorSummary(error));
  }
}

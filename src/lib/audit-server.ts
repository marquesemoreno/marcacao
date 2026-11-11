import { errorSummary } from "@/lib/safe-error";
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditDiff } from "@/lib/audit";

/** Grava uma alteração em audit_logs. Nunca quebra a ação que chamou: auditoria que falha
 * (ex.: migration ainda não aplicada) só vai pro console/Sentry. Sem mudança, não grava. */
export async function recordAudit(input: {
  clinicId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}): Promise<void> {
  const changes = auditDiff(input.before, input.after);
  if (Object.keys(changes).length === 0) return;
  try {
    await prisma.auditLog.create({
      data: {
        clinicId: input.clinicId,
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error("[audit] falha ao gravar", input.action, input.entityId, errorSummary(e));
  }
}

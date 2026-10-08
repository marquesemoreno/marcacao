import "server-only";
import type { Prisma } from "@prisma/client";
import { isTeamQueueUser } from "@/lib/team-queue";

/**
 * Distribuição automática de conversa NOVA pro atendente menos ocupado — só pra
 * Urolaser (pedido explícito, 2026-10-01: 371 conversas acumuladas sem dono porque
 * o padrão do sistema é "pull" — quem responde primeiro vira dono, ver
 * autoAssignOnReply em actions/inbox.ts). Só vale pra conversas CRIADAS a partir de
 * agora; as já paradas continuam sem dono de propósito (decisão do usuário, não
 * redistribuir retroativamente um volume grande de uma vez só).
 */
const AUTO_ASSIGN_CLINIC_TRADE_NAME = "Urolaser - Clínica de Urologia e Diagnóstico";

async function getAutoAssignClinicId(tx: Prisma.TransactionClient): Promise<string | null> {
  const clinic = await tx.clinic.findFirst({ where: { tradeName: AUTO_ASSIGN_CLINIC_TRADE_NAME }, select: { id: true } });
  return clinic?.id ?? null;
}

/** Atendente ativo da clínica com menos conversas ativas atribuídas no momento —
 * exclui a conta "Equipe X" (fila de Não Atribuídas, não é um atendente de
 * verdade, ver isTeamQueueUser). `null` se não houver nenhum atendente ativo. */
export async function pickLeastBusyAttendant(tx: Prisma.TransactionClient, clinicId: string): Promise<string | null> {
  const activeUsers = await tx.user.findMany({
    where: { clinicId, role: "CLINIC", active: true, isAttendant: true },
    select: { id: true, name: true, clinic: { select: { tradeName: true } } },
    orderBy: { name: "asc" },
  });
  const candidates = activeUsers.filter((u) => !isTeamQueueUser(u));
  if (candidates.length === 0) return null;

  const loadByUser = await tx.conversation.groupBy({
    by: ["assignedUserId"],
    where: {
      clinicId,
      assignedUserId: { in: candidates.map((c) => c.id) },
      status: { in: ["OPEN", "PENDING"] },
      archivedAt: null,
    },
    _count: { id: true },
  });
  const loadMap = new Map(loadByUser.map((row) => [row.assignedUserId, row._count.id]));

  let best = candidates[0];
  let bestLoad = loadMap.get(best.id) ?? 0;
  for (const candidate of candidates.slice(1)) {
    const load = loadMap.get(candidate.id) ?? 0;
    if (load < bestLoad) {
      best = candidate;
      bestLoad = load;
    }
  }
  return best.id;
}

/** Spalha no `data` de um `conversation.create` — `{}` (sem efeito) pra qualquer
 * clínica que não seja a Urolaser, ou se não houver atendente ativo pra atribuir. */
export async function autoAssignNewConversation(
  tx: Prisma.TransactionClient,
  clinicId: string
): Promise<{ assignedUserId: string; assignmentSeenAt: null } | Record<string, never>> {
  const autoAssignClinicId = await getAutoAssignClinicId(tx);
  if (!autoAssignClinicId || clinicId !== autoAssignClinicId) return {};

  const userId = await pickLeastBusyAttendant(tx, clinicId);
  if (!userId) return {};

  return { assignedUserId: userId, assignmentSeenAt: null };
}

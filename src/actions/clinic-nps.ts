"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { periodWindow, type PeriodKey } from "@/lib/report-period";
import { npsBucket, npsSummary } from "@/lib/nps";
import { decryptFormAnswers } from "@/lib/patient-form-server";

/** Relatório: NPS do período (passo "Satisfação" da régua) + últimos comentários. */
export async function getClinicNpsReport(period: PeriodKey = "30") {
  const { clinicId } = await requireClinicPermission("relatorios");
  const { since, until } = periodWindow(period, false);
  // Tabela nova (migration 20261102200000): se ainda não aplicada, o relatório segue sem o cartão.
  const rows = await prisma.npsResponse
    .findMany({
      where: { clinicId, submittedAt: { gte: since, lt: until ?? new Date() } },
      orderBy: { submittedAt: "desc" },
      select: { score: true, commentEncrypted: true, submittedAt: true },
    })
    .catch(() => []);
  const comments = rows
    .filter((r) => r.commentEncrypted)
    .slice(0, 6)
    .map((r) => {
      let text = "";
      try {
        text = decryptFormAnswers(r.commentEncrypted!).comment ?? "";
      } catch {
        // chave trocada/linha corrompida: não derruba o relatório
      }
      return { score: r.score, bucket: npsBucket(r.score), text, at: r.submittedAt.toISOString() };
    })
    .filter((c) => c.text);
  return { ...npsSummary(rows.map((r) => r.score)), comments };
}

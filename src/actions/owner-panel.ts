"use server";

import { requireClinicManager } from "@/lib/session";
import { recordAudit } from "@/lib/audit-server";
import { fetchBridgeBillingSummary, fetchBridgeFinanceSummary, fetchBridgeStockSummary } from "@/lib/hospital-bridge";

/** Mês AAAA-MM → primeiro e último dia. */
function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { inicio: `${month}-01`, fim: `${month}-${String(last).padStart(2, "0")}` };
}

function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

/** Painel do dono (Etapa 5.2): faturamento, financeiro e estoque do sistema da clínica. Só
 * gestão; cada abertura fica no log de auditoria. */
export async function getOwnerPanel(month: string) {
  const { clinicId, userId } = await requireClinicManager();
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7);
  const { inicio, fim } = monthRange(safeMonth);
  const prev = monthRange(previousMonth(safeMonth));
  const [billing, billingPrev, finance, stock] = await Promise.all([
    fetchBridgeBillingSummary(clinicId, inicio, fim),
    fetchBridgeBillingSummary(clinicId, prev.inicio, prev.fim),
    fetchBridgeFinanceSummary(clinicId, inicio, fim),
    fetchBridgeStockSummary(clinicId),
  ]);
  await recordAudit({ clinicId, userId, action: "owner_panel.view", entity: "Clinic", entityId: clinicId, before: null, after: { month: safeMonth } }).catch(() => {});
  return { month: safeMonth, billing, billingPrev: billingPrev.ok ? billingPrev.data : null, finance, stock };
}

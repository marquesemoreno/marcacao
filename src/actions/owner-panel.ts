"use server";

import { requireClinicManager } from "@/lib/session";
import { recordAudit } from "@/lib/audit-server";
import { fetchBridgeFinanceSummary, fetchBridgeStockSummary } from "@/lib/hospital-bridge";

/** Mês AAAA-MM → primeiro e último dia. */
function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { inicio: `${month}-01`, fim: `${month}-${String(last).padStart(2, "0")}` };
}

/** Painel do dono (Etapa 5.2): financeiro + estoque do sistema da clínica. Só gestão; cada
 * abertura fica no log de auditoria. */
export async function getOwnerPanel(month: string) {
  const { clinicId, userId } = await requireClinicManager();
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7);
  const { inicio, fim } = monthRange(safeMonth);
  const [finance, stock] = await Promise.all([
    fetchBridgeFinanceSummary(clinicId, inicio, fim),
    fetchBridgeStockSummary(clinicId),
  ]);
  await recordAudit({ clinicId, userId, action: "owner_panel.view", entity: "Clinic", entityId: clinicId, before: null, after: { month: safeMonth } }).catch(() => {});
  return { month: safeMonth, finance, stock };
}

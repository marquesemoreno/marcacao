"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDate, formatPhone } from "@/lib/format";
import { confirmCopilotCancelAppointment, confirmCopilotCampaignDraft } from "@/actions/copilot";
import type { PendingAssistantAction } from "@/lib/assistant-tools";

/** Trava de confirmação visual: renderizada quando a resposta do Copiloto trouxe
 * um `pendingAction` (ver runCopilotCommand em actions/copilot.ts) — a IA só
 * localizou/montou a proposta, a mutação de verdade só roda no onClick daqui. */
export function ActionConfirmationCard({ action, onSettled }: { action: PendingAssistantAction; onSettled: () => void }) {
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (action.kind === "cancelAppointment") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
        <p className="text-xs font-semibold text-amber-800">Confirme o agendamento a cancelar:</p>
        {action.candidates.map((c) => (
          <div key={c.appointmentId} className="rounded-lg bg-white border border-amber-100 p-2.5 space-y-1.5">
            <div className="text-sm font-medium text-slate-800">{c.patientName}</div>
            <div className="text-xs text-slate-500">
              {c.procedureName} • {formatDate(c.date)}
              {c.timeSlot ? ` às ${c.timeSlot}` : ""}
            </div>
            <div className="text-xs text-slate-400">{formatPhone(c.patientPhone)}</div>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await confirmCopilotCancelAppointment(c.appointmentId);
                  toast.success("Agendamento cancelado — paciente avisado por WhatsApp.");
                  onSettled();
                } catch {
                  toast.error("Não foi possível cancelar. Tente de novo.");
                  setBusy(false);
                }
              }}
              className="w-full rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 transition-colors"
            >
              {busy ? "Cancelando..." : "Confirmar Cancelamento"}
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setDismissed(true)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-sky-800">Rascunho de campanha:</p>
      <div className="rounded-lg bg-white border border-sky-100 p-2.5 space-y-1">
        <div className="text-sm font-medium text-slate-800">{action.recipients.length} destinatário(s)</div>
        <div className="text-xs text-slate-500">{action.targetFilterLabel}</div>
        <div className="text-xs text-slate-400 line-clamp-2">{action.messageTemplate}</div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await confirmCopilotCampaignDraft({
                campaignName: action.campaignName,
                messageTemplate: action.messageTemplate,
                recipients: action.recipients.map((r) => ({ phone: r.phone, variables: { nome: r.name ?? "" } })),
              });
              toast.success("Rascunho criado — revise em Disparos antes de enviar.");
              onSettled();
            } catch {
              toast.error("Não foi possível criar o rascunho.");
              setBusy(false);
            }
          }}
          className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 transition-colors"
        >
          {busy ? "Criando..." : "Confirmar Ação"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg border border-slate-200 text-xs font-medium px-3 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

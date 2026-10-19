"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addLossReason, listLossReasons, removeLossReason } from "@/actions/loss-reasons";
import { customLossReasonLabel, resolveLossReasons } from "@/lib/loss-reasons";

/** Desfechos ao mover um card pra "Finalizado" no CRM. Os de perda (PERDA_*) capturam a
 * objeção do paciente — base pro relatório de por que não fechou. */
const WON = [
  { id: "AGENDAMENTO_CONCLUIDO", label: "Agendou / realizou" },
  { id: "DUVIDA_ESCLARECIDA", label: "Só tirou dúvida" },
  { id: "ADMINISTRATIVO", label: "Administrativo (médico ou equipe)" },
];

export function LostReasonModal({
  patientName,
  open,
  onCancel,
  onConfirm,
}: {
  patientName: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (resolution: { reason: string; notes?: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // Padrões + os da clínica. Fora do painel da clínica (admin) a lista não carrega e ficam só os padrões.
  const [lost, setLost] = useState(resolveLossReasons([]));
  const [canManage, setCanManage] = useState(false);
  const [newReason, setNewReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setNotes("");
    setNewReason("");
    setReasonError(null);
    listLossReasons()
      .then((list) => {
        if (!list) return setCanManage(false);
        setLost(list);
        setCanManage(true);
      })
      .catch(() => setCanManage(false));
  }, [open]);

  async function handleAdd() {
    if (!newReason.trim()) return;
    setReasonError(null);
    try {
      setLost(await addLossReason(newReason));
      setNewReason("");
    } catch (e) {
      setReasonError(e instanceof Error ? e.message : "Não foi possível adicionar.");
    }
  }

  async function handleRemove(id: string) {
    const label = customLossReasonLabel(id);
    if (!label) return;
    if (reason === id) setReason(null);
    setLost(await removeLossReason(label));
  }

  const needsNotes = reason === "PERDA_OUTRO";
  const option = (o: { id: string; label: string }, tone: "won" | "lost") => (
    <button
      key={o.id}
      type="button"
      role="radio"
      aria-checked={reason === o.id}
      onClick={() => setReason(o.id)}
      className={`rounded-lg border px-3 py-2 text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
        reason === o.id
          ? tone === "won"
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200"
            : "border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      {o.label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar {patientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Fechou</p>
            <div role="radiogroup" aria-label="Fechou" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {WON.map((o) => option(o, "won"))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Não fechou — por quê?</p>
            <div role="radiogroup" aria-label="Motivo da perda" className="grid grid-cols-2 gap-2">
              {lost.map((o) => (
                <div key={o.id} className="relative">
                  {option(o, "lost")}
                  {canManage && customLossReasonLabel(o.id) && (
                    <button
                      type="button"
                      aria-label={`Remover motivo ${o.label}`}
                      onClick={() => handleRemove(o.id)}
                      className="absolute right-1.5 top-1.5 rounded p-0.5 text-slate-400 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {canManage && (
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Novo motivo de perda"
                  value={newReason}
                  maxLength={40}
                  onChange={(e) => setNewReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder="Novo motivo da clínica (ex.: foi para outra clínica)"
                  className="h-9 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newReason.trim()}
                  className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" aria-hidden /> Adicionar
                </button>
              </div>
              {reasonError && (
                <p role="alert" className="mt-1 text-xs text-rose-600">
                  {reasonError}
                </p>
              )}
            </div>
          )}
          {(needsNotes || reason?.startsWith("PERDA_")) && (
            <div>
              <label htmlFor="lost-notes" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {needsNotes ? "Qual foi o motivo?" : "Observação (opcional)"}
              </label>
              <textarea
                id="lost-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={needsNotes ? "Ex.: vai fazer em outra cidade" : "Ex.: achou caro, vai pensar"}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="h-9 px-4 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={!reason || saving || (needsNotes && !notes.trim())}
              onClick={async () => {
                if (!reason) return;
                setSaving(true);
                try {
                  await onConfirm({ reason, notes: notes.trim() || undefined });
                } finally {
                  setSaving(false);
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Finalizar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

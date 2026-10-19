"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, MessageCircle, Undo2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addWaitlistEntry,
  getSlotCandidates,
  listWaitlist,
  setWaitlistEntryStatus,
  type SlotCandidate,
  type WaitlistRow,
} from "@/actions/waitlist";
import { WAITLIST_PERIODS, WAITLIST_PERIOD_LABEL, type OpenSlot, type WaitlistPeriod } from "@/lib/waitlist";
import { formatPhone } from "@/lib/format";

const input =
  "h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500";
const ghostBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";

function slotLabel(slot: OpenSlot) {
  const date = new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  return `${date} às ${slot.time}${slot.doctor ? ` · ${slot.doctor}` : ""}`;
}

/** Lista de espera da agenda. Aberta pelo botão da Agenda (cadastro e consulta) ou, com
 * `slot`, logo depois de uma marcação cancelada/faltosa liberar uma vaga: mostra quem da
 * espera combina, com a oferta pronta para a recepção revisar e enviar pelo WhatsApp. */
export function WaitlistDialog({
  open,
  onOpenChange,
  doctors,
  slot,
  exceptPhone,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: string[];
  slot?: OpenSlot | null;
  exceptPhone?: string | null;
  onChanged?: (waitingCount: number) => void;
}) {
  const [entries, setEntries] = useState<WaitlistRow[] | null>(null);
  const [candidates, setCandidates] = useState<SlotCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ patientName: "", phone: "", doctorName: "", period: "ANY" as WaitlistPeriod, notes: "" });

  const refreshCandidates = useCallback(async () => {
    if (!slot) return setCandidates(null);
    setCandidates(await getSlotCandidates(slot, exceptPhone));
  }, [slot, exceptPhone]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    listWaitlist()
      .then((list) => {
        setEntries(list);
        onChanged?.(list.filter((e) => e.status === "WAITING").length);
      })
      .catch(() => setError("Não foi possível carregar a lista de espera."));
    refreshCandidates().catch(() => setCandidates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshCandidates]);

  async function run(action: () => Promise<WaitlistRow[]>) {
    setError(null);
    try {
      const list = await action();
      setEntries(list);
      onChanged?.(list.filter((e) => e.status === "WAITING").length);
      await refreshCandidates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar. Tente de novo.");
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await run(() => addWaitlistEntry(form));
    setSaving(false);
    setForm((f) => ({ ...f, patientName: "", phone: "", notes: "" }));
  }

  const offered = (c: SlotCandidate) => run(() => setWaitlistEntryStatus(c.id, "OFFERED"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lista de espera</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {slot && (
            <section aria-label="Vaga aberta" className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 space-y-2">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 first-letter:uppercase">Vaga aberta: {slotLabel(slot)}</p>
              {candidates === null ? (
                <p className="text-sm text-slate-500">Procurando quem combina…</p>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">Ninguém na lista combina com esta vaga (médico ou período).</p>
              ) : (
                <ul className="space-y-2">
                  {candidates.map((c, i) => (
                    <li key={c.id} className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {i + 1}. {c.patientName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {formatPhone(c.phone)} · {c.doctorName ?? "qualquer médico"} · {WAITLIST_PERIOD_LABEL[c.period as WaitlistPeriod] ?? c.period}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <a
                            href={c.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => offered(c)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                          >
                            <MessageCircle className="w-4 h-4" aria-hidden /> Oferecer
                          </a>
                          <button
                            type="button"
                            className={ghostBtn}
                            onClick={() => {
                              navigator.clipboard?.writeText(c.message).then(() => toast.success("Texto copiado."));
                            }}
                          >
                            <Copy className="w-4 h-4" aria-hidden /> Copiar
                          </button>
                          <button type="button" className={ghostBtn} onClick={() => run(() => setWaitlistEntryStatus(c.id, "BOOKED"))}>
                            <Check className="w-4 h-4" aria-hidden /> Encaixou
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                “Oferecer” abre o WhatsApp com o texto pronto — você revisa e envia. Depois, agende o horário no sistema da clínica.
              </p>
            </section>
          )}

          <section aria-label="Quem está esperando">
            <h3 className="text-sm font-semibold mb-2">
              Esperando {entries ? `(${entries.filter((e) => e.status === "WAITING").length})` : ""}
            </h3>
            {entries === null ? (
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…
              </p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-slate-500">Ninguém na lista ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {e.patientName}
                        {e.status === "OFFERED" && (
                          <span className="ml-2 rounded-md bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">oferta enviada</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatPhone(e.phone)} · {e.doctorName ?? "qualquer médico"} · {WAITLIST_PERIOD_LABEL[e.period as WaitlistPeriod] ?? e.period}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {e.status === "OFFERED" && (
                        <button type="button" className={ghostBtn} title="Voltar para a fila" onClick={() => run(() => setWaitlistEntryStatus(e.id, "WAITING"))}>
                          <Undo2 className="w-4 h-4" aria-hidden /> <span className="sr-only">Voltar para a fila</span>
                        </button>
                      )}
                      <button type="button" className={ghostBtn} aria-label={`Tirar ${e.patientName} da lista`} title="Tirar da lista" onClick={() => run(() => setWaitlistEntryStatus(e.id, "CANCELLED"))}>
                        <X className="w-4 h-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={handleAdd} className="space-y-2" aria-label="Adicionar à lista de espera">
            <h3 className="text-sm font-semibold">Adicionar paciente</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={input} aria-label="Nome do paciente" placeholder="Nome" required value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
              <input className={input} aria-label="WhatsApp com DDD" placeholder="WhatsApp com DDD" required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input
                className={input}
                aria-label="Médico (opcional)"
                placeholder="Médico (vazio = qualquer um)"
                list="waitlist-doctors"
                value={form.doctorName}
                onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
              />
              <datalist id="waitlist-doctors">
                {doctors.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <select className={input} aria-label="Período" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value as WaitlistPeriod })}>
                {WAITLIST_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {WAITLIST_PERIOD_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <input className={input} aria-label="Observação (opcional)" placeholder="Observação (opcional)" maxLength={200} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Adicionar à lista
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

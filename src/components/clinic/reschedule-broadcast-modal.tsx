"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDistinctDoctorNames, getAppointmentsByDoctorAndDate } from "@/actions/clinic";
import { createRescheduleBroadcast } from "@/actions/clinic-broadcast";

const DEFAULT_TEMPLATE =
  "Olá {{nome}}, informamos que por motivo de força maior, o Dr(a). {{medico}} não poderá atender no dia {{data}}. Para sua comodidade, você tem prioridade para remarcação. Responda esta mensagem para escolhermos um novo horário.";

type PreviewRow = { id: string; patientName: string; patientPhone: string; timeSlot: string | null };

/** Modal do botão "Aviso / Remarcação em Massa" (ver /clinic/disparos) — médico
 * desmarcou a agenda de um dia, avisa todos os pacientes agendados com ele de uma vez.
 * Cria e já inicia a campanha (createRescheduleBroadcast) em vez de deixar rascunho,
 * porque o cenário é urgente por natureza. */
export function RescheduleBroadcastModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [doctorNames, setDoctorNames] = useState<string[]>([]);
  const [doctorName, setDoctorName] = useState("");
  const [date, setDate] = useState("");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    getDistinctDoctorNames()
      .then(setDoctorNames)
      .catch(() => toast.error("Erro ao carregar lista de médicos."));
  }, [open]);

  useEffect(() => {
    if (!doctorName || !date) {
      setPreview([]);
      return;
    }
    setLoadingPreview(true);
    getAppointmentsByDoctorAndDate(doctorName, new Date(`${date}T00:00:00Z`))
      .then(setPreview)
      .catch(() => toast.error("Erro ao carregar pacientes afetados."))
      .finally(() => setLoadingPreview(false));
  }, [doctorName, date]);

  function reset() {
    setDoctorName("");
    setDate("");
    setTemplate(DEFAULT_TEMPLATE);
    setPreview([]);
  }

  async function handleSend() {
    setSending(true);
    try {
      const result = await createRescheduleBroadcast(doctorName, new Date(`${date}T00:00:00Z`), template);
      toast.success(`Aviso disparado para ${result.recipientCount} paciente(s).`);
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao disparar aviso.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Aviso / Remarcação em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reschedule-doctor" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Médico
              </label>
              <select
                id="reschedule-doctor"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full mt-1 h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">Selecione o médico</option>
                {doctorNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {doctorNames.length === 0 && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Nenhum médico cadastrado ainda — preencha em /clinic/agendamentos.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="reschedule-date" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Data afetada
              </label>
              <input
                id="reschedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1 h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {doctorName && date && (
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Pacientes afetados
              </label>
              <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden max-h-40 overflow-y-auto">
                {loadingPreview ? (
                  <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
                  </div>
                ) : preview.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
                    Nenhum agendamento ativo com esse médico nessa data.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Horário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{p.patientName}</TableCell>
                          <TableCell className="text-xs">{p.patientPhone}</TableCell>
                          <TableCell className="text-xs">{p.timeSlot ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="reschedule-template" className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Mensagem
            </label>
            <textarea
              id="reschedule-template"
              rows={4}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Variáveis disponíveis: {"{{nome}}"}, {"{{medico}}"}, {"{{data}}"}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <DialogClose className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              Cancelar
            </DialogClose>
            <button
              type="button"
              disabled={sending || preview.length === 0}
              onClick={handleSend}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-all"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? "Disparando..." : `Disparar para ${preview.length} paciente(s)`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStageMessageDraft, listStageMessages, saveStageMessage } from "@/actions/stage-messages";
import { sendMessage } from "@/actions/inbox";
import { CANNED_VARIABLES } from "@/lib/canned-variables";
import { STAGE_MESSAGE_MAX_LENGTH, STAGE_MESSAGE_STAGES, type StageMessageStage } from "@/lib/stage-messages";

const STAGE_LABEL: Record<StageMessageStage, string> = { orcamento: "Orçamento", agendado: "Agendado" };
const textarea =
  "mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500";

/** Depois de mover o card para Orçamento ou Agendado: se a clínica cadastrou uma mensagem
 * para a etapa, mostra o texto (com nome, médico e clínica) para a recepção revisar e enviar.
 * Sem modelo cadastrado — ou fora do painel da clínica — não aparece nada. */
export function StageMessagePrompt({
  target,
  onClose,
}: {
  target: { conversationId: string; stage: StageMessageStage; patientName: string } | null;
  onClose: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setText(null);
    if (!target) return;
    let alive = true;
    getStageMessageDraft(target.conversationId, target.stage)
      .then((draft) => {
        if (!alive) return;
        if (!draft) return onClose();
        setText(draft.text);
        setUnresolved(draft.unresolved);
      })
      .catch(() => alive && onClose());
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.conversationId, target?.stage]);

  async function handleSend() {
    if (!target || !text?.trim()) return;
    setSending(true);
    try {
      await sendMessage(target.conversationId, text.trim());
      toast.success(`Mensagem enviada para ${target.patientName}.`);
      onClose();
    } catch {
      toast.error("Não foi possível enviar. Tente pelo Chat.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={!!target && text !== null} onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Avisar {target?.patientName} — {target ? STAGE_LABEL[target.stage] : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label htmlFor="stage-message-text" className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Mensagem (você pode editar antes de enviar)
          </label>
          <textarea id="stage-message-text" rows={5} value={text ?? ""} onChange={(e) => setText(e.target.value)} className={textarea} />
          {unresolved.length > 0 && text && unresolved.some((k) => new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "i").test(text)) && (
            <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">
              Falta preencher: {unresolved.map((k) => `{{${k}}}`).join(", ")}. Troque pelo valor antes de enviar.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={sending} onClick={onClose} className="h-9 rounded-lg px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
              Agora não
            </button>
            <button
              type="button"
              disabled={sending || !text?.trim()}
              onClick={handleSend}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {sending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Enviar mensagem
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Botão "Mensagens por etapa" do CRM: a clínica escreve o texto sugerido de cada etapa. */
export function StageMessageSettings() {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [values, setValues] = useState<Record<StageMessageStage, string> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listStageMessages()
      .then((v) => {
        setValues(v);
        setAvailable(true);
      })
      .catch(() => setAvailable(false)); // admin: sem clínica na sessão
  }, []);

  if (!available || !values) return null;

  async function handleSave() {
    setSaving(true);
    try {
      for (const stage of STAGE_MESSAGE_STAGES) setValues(await saveStageMessage(stage, values![stage]));
      toast.success("Mensagens salvas.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 rounded-lg px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
      >
        Mensagens por etapa
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mensagens por etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Ao arrastar um paciente para a etapa, o texto aparece para a recepção revisar e enviar. Deixe em branco para não sugerir nada.
            </p>
            {STAGE_MESSAGE_STAGES.map((stage) => (
              <div key={stage}>
                <label htmlFor={`stage-${stage}`} className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {STAGE_LABEL[stage]}
                </label>
                <textarea
                  id={`stage-${stage}`}
                  rows={3}
                  maxLength={STAGE_MESSAGE_MAX_LENGTH}
                  value={values[stage]}
                  onChange={(e) => setValues({ ...values, [stage]: e.target.value })}
                  className={textarea}
                />
              </div>
            ))}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Variáveis: {CANNED_VARIABLES.filter((v) => v.key !== "data").map((v) => `{{${v.key}}}`).join(" ")}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Salvar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

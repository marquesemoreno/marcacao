"use client";

import { useState } from "react";
import { Bot, Loader2, CheckCircle2, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getAiAttendantConfig, saveAiAttendantConfig } from "@/actions/admin-ai-attendant";

type ConfigState = { active: boolean; instructions: string };

export function AiAttendantModal({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [active, setActive] = useState(false);
  const [instructions, setInstructions] = useState("");

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await getAiAttendantConfig(clinicId);
      setConfig(data);
      setActive(data?.active ?? false);
      setInstructions(data?.instructions ?? "");
    } catch {
      toast.error("Erro ao carregar o atendente de IA.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) loadConfig();
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveAiAttendantConfig(clinicId, { active, instructions });
      toast.success("Atendente de IA salvo.");
      await loadConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex items-center justify-center w-9 h-9 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900 border border-violet-200 dark:border-violet-800 rounded-xl transition-all cursor-pointer"
        title="Atendente de IA"
        aria-label="Atendente de IA"
      >
        <Bot className="w-4 h-4" />
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            Atendente de IA — {clinicName}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Responde os pacientes automaticamente pelo WhatsApp. Antes de qualquer resposta,
            o paciente sempre recebe um aviso de que é um atendimento por IA e precisa
            confirmar que quer continuar (consentimento LGPD) — isso e a transferência
            automática para um humano em situações de risco não são editáveis por aqui.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            <div className="flex items-center justify-between gap-2">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  active
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                }`}
              >
                {active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                {active ? "Ativo" : "Desativado"}
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => setActive((prev) => !prev)}
                className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                {active ? "Desativar" : "Ativar"}
              </button>
            </div>

            <div>
              <label htmlFor="ai-instructions" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Instruções da clínica
              </label>
              <textarea
                id="ai-instructions"
                rows={6}
                placeholder="Ex: Atendemos consultas de urologia e exames de imagem. Horário de funcionamento: seg-sex 8h-18h. Não agendamos por aqui ainda, apenas tire dúvidas e informe que um atendente confirma o agendamento."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl transition-all"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

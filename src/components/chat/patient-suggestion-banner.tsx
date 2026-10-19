"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { applyPatientSuggestion, dismissPatientSuggestion, getPatientSuggestion } from "@/actions/patient-suggestion";

type Suggestion = { cpf: string | null; convenio: string | null };

/** CPF/convênio que o paciente escreveu na conversa e ainda não estão no cadastro. A
 * atendente aplica ou descarta — nada é gravado sozinho. Fora do painel da clínica (admin)
 * a action recusa e o aviso simplesmente não aparece. */
export function PatientSuggestionBanner({ conversationId, refreshKey }: { conversationId: string; refreshKey?: number | string }) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setSuggestion(null);
    getPatientSuggestion(conversationId)
      .then((s) => alive && setSuggestion(s))
      .catch(() => alive && setSuggestion(null));
    return () => {
      alive = false;
    };
  }, [conversationId, refreshKey]);

  if (!suggestion) return null;
  const parts = [suggestion.cpf && `CPF ${suggestion.cpf}`, suggestion.convenio && `convênio ${suggestion.convenio}`].filter(Boolean).join(" · ");

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    try {
      await action();
      setSuggestion(null);
      toast.success(done);
    } catch {
      toast.error("Não foi possível salvar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-sm text-sky-900 dark:text-sky-200">
      <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        O paciente informou: <strong className="font-semibold">{parts}</strong>. Salvar no cadastro?
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => applyPatientSuggestion(conversationId), "Cadastro atualizado.")}
        className="h-8 rounded-md bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      >
        Salvar
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => dismissPatientSuggestion(conversationId), "Sugestão descartada.")}
        className="h-8 rounded-md px-3 text-sm font-medium hover:bg-sky-100 dark:hover:bg-sky-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      >
        Descartar
      </button>
    </div>
  );
}

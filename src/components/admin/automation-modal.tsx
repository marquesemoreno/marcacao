"use client";

import { useState } from "react";
import { Plus, Pencil, MessageSquareText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createChatAutomation, updateChatAutomation } from "@/actions/chat-automations";
import { toast } from "sonner";

type AutomationRecord = { id: string; keyword: string; responseText: string; active: boolean };

type AutomationModalProps = {
  automation?: AutomationRecord;
  onSaved?: (automation: AutomationRecord) => void;
};

export function AutomationModal({ automation, onSaved }: AutomationModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(automation);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const input = {
      keyword: String(formData.get("keyword") ?? ""),
      responseText: String(formData.get("responseText") ?? ""),
    };

    try {
      const saved = automation
        ? await updateChatAutomation(automation.id, input)
        : await createChatAutomation(input);
      toast.success(automation ? "Automação atualizada com sucesso!" : "Automação criada com sucesso!");
      onSaved?.(saved);
      setOpen(false);
    } catch {
      toast.error("Erro ao salvar. Confira se essa palavra-chave já não está em uso.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={
          isEditing
            ? "inline-flex items-center justify-center w-8 h-8 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
            : "inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-xs transition-all"
        }
        title={isEditing ? "Editar automação" : undefined}
      >
        {isEditing ? <Pencil className="w-3.5 h-3.5" /> : (
          <>
            <Plus className="w-4 h-4" />
            <span>Nova Automação</span>
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-emerald-600" />
            {isEditing ? "Editar Automação" : "Nova Automação por Palavra-Chave"}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Quando o paciente mandar uma mensagem contendo essa palavra, a resposta abaixo é enviada
            automaticamente pelo WhatsApp.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              Palavra-chave *
            </label>
            <input
              name="keyword"
              required
              defaultValue={automation?.keyword}
              placeholder="Ex: horário, endereço, preço"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              Não diferencia maiúsculas/minúsculas. Dispara se a palavra aparecer em qualquer parte da mensagem do paciente.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              Resposta automática *
            </label>
            <textarea
              name="responseText"
              required
              rows={4}
              defaultValue={automation?.responseText}
              placeholder="Ex: Nosso horário de atendimento é de segunda a sexta, das 8h às 18h."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-xs disabled:opacity-60"
            >
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Automação"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

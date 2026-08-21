"use client";

import { useState } from "react";
import { MessageSquareText, Trash2 } from "lucide-react";
import { toggleChatAutomationActive, deleteChatAutomation } from "@/actions/chat-automations";
import { AutomationModal } from "./automation-modal";
import { toast } from "sonner";

export type AutomationItem = {
  id: string;
  keyword: string;
  responseText: string;
  active: boolean;
};

export function AutomationsManagement({ automations: initialAutomations }: { automations: AutomationItem[] }) {
  const [automations, setAutomations] = useState<AutomationItem[]>(initialAutomations);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

  const activeCount = automations.filter((a) => a.active).length;
  const pausedCount = automations.filter((a) => !a.active).length;

  const filtered = automations.filter((automation) =>
    statusFilter === "all" ? true : statusFilter === "active" ? automation.active : !automation.active
  );

  async function handleToggleActive(id: string, currentActive: boolean) {
    const nextState = !currentActive;
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, active: nextState } : a)));
    try {
      await toggleChatAutomationActive(id, nextState);
      toast.success(nextState ? "Automação ativada!" : "Automação pausada.");
    } catch {
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, active: currentActive } : a)));
      toast.error("Erro ao alterar status da automação.");
    }
  }

  function handleSaved(saved: AutomationItem) {
    setAutomations((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
    });
  }

  async function handleDelete(id: string, keyword: string) {
    if (!window.confirm(`Excluir a automação da palavra-chave "${keyword}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    const previous = automations;
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    try {
      await deleteChatAutomation(id);
      toast.success("Automação excluída.");
    } catch {
      setAutomations(previous);
      toast.error("Erro ao excluir a automação.");
    }
  }

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 p-4 sm:p-6 flex-1 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Automações de Resposta no WhatsApp
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Palavras-chave que disparam uma resposta automática assim que o paciente escreve — vale pra
            qualquer clínica da rede.
          </p>
        </div>

        <AutomationModal onSaved={handleSaved} />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "all"
              ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-2xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          Todas ({automations.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            statusFilter === "active"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Ativas ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("paused")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            statusFilter === "paused"
              ? "bg-slate-700 text-white shadow-2xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          Pausadas ({pausedCount})
        </button>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma automação encontrada</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {automations.length === 0
                ? 'Clique em "Nova Automação" pra cadastrar a primeira resposta automática.'
                : "Tente ajustar o filtro de status selecionado."}
            </p>
          </div>
        ) : (
          filtered.map((automation) => (
            <div
              key={automation.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xs border border-slate-200/80 dark:border-slate-800 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-2xs">
                  <MessageSquareText className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold">
                  {automation.keyword}
                </span>
              </div>

              <p className="flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {automation.responseText}
              </p>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleActive(automation.id, automation.active)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                    automation.active
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                  }`}
                  title="Clique para ativar ou pausar essa automação"
                >
                  {automation.active ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Ativa</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>Pausada</span>
                    </>
                  )}
                </button>

                <AutomationModal automation={automation} onSaved={handleSaved} />

                <button
                  type="button"
                  onClick={() => handleDelete(automation.id, automation.keyword)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-all"
                  title="Excluir automação"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

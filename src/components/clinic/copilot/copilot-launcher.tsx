"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { CopilotChat } from "@/components/clinic/copilot/copilot-chat";

const TRIGGER_CLASSES =
  "fixed bottom-5 right-20 z-50 inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer print:hidden";

/** Botão flutuante + atalho global Ctrl+K/Cmd+K pro Copiloto da Recepção — mesmo
 * padrão de posicionamento do FeedbackWidget (feedback-widget.tsx), só deslocado
 * (`right-20` em vez de `right-5`) pra não empilhar os dois botões no mesmo canto. */
export function CopilotLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={TRIGGER_CLASSES}
        title="Copiloto da Recepção (Ctrl+K)"
        aria-label="Abrir Copiloto da Recepção"
      >
        <Sparkles className="w-5 h-5" />
      </button>
      <CopilotChat open={open} onOpenChange={setOpen} />
    </>
  );
}

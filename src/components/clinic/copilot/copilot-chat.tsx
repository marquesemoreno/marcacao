"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { runCopilotCommand, type CopilotChatMessage } from "@/actions/copilot";
import { SuggestionChips } from "@/components/clinic/copilot/suggestion-chips";
import { ActionConfirmationCard } from "@/components/clinic/copilot/action-confirmation-card";
import type { PendingAssistantAction } from "@/lib/assistant-tools";

type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pendingAction?: PendingAssistantAction;
};

export function CopilotChat({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMessage: DisplayMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    try {
      const history: CopilotChatMessage[] = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const result = await runCopilotCommand(history);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: result.message, pendingAction: result.pendingAction },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Não consegui processar esse comando agora. Tente de novo." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleActionSettled(messageId: string) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, pendingAction: undefined } : m)));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="border-b border-slate-200">
          <SheetTitle className="flex items-center gap-2 text-slate-900">
            <Sparkles className="w-4 h-4 text-emerald-600" /> Copiloto da Recepção
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && <SuggestionChips onSelect={send} />}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[90%] space-y-2">
                <div
                  className={
                    m.role === "user"
                      ? "rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm"
                      : "rounded-lg bg-slate-100 text-slate-800 px-3 py-2 text-sm whitespace-pre-wrap"
                  }
                >
                  {m.content}
                </div>
                {m.pendingAction && <ActionConfirmationCard action={m.pendingAction} onSettled={() => handleActionSettled(m.id)} />}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pensando...
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-slate-200 flex-row gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ex: desmarcar consulta da Maria Silva..."
            disabled={sending}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 w-9 h-9 text-white shrink-0 transition-colors"
            title="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

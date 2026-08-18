"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

type Message = {
  id: string;
  sender: "user" | "bot";
  text: string;
  recommendation?: {
    procedureName: string;
    clinicName: string;
    neighborhood: string;
    city: string;
    preparation?: string | null;
    whatsappUrl: string;
  };
};

export function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-1",
      sender: "bot",
      text: "Olá! 👋 Sou a assistente virtual da Conecta Saúde. O que você precisa hoje? (Ex: exames, consultas, especialidades ou sintomas).",
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });

      if (!res.ok) throw new Error("Erro na comunicação");

      const data = await res.json();
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.reply,
        recommendation: data.recommendation,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "bot",
          text: "Desculpe, ocorreu um erro ao consultar o catálogo. Você pode buscar diretamente na nossa página de procedimentos ou tentar novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end print:hidden">
      {/* Floating Widget Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 p-3.5 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-teal-600/40 active:scale-95"
          aria-label="Abrir Assistente de IA Conecta Saúde"
        >
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-xs">
            <Bot className="h-5 w-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
            </span>
          </div>

          <div className="hidden sm:flex flex-col items-start pr-2">
            <span className="text-xs font-extrabold tracking-tight">Assistente Virtual IA</span>
            <span className="text-[10px] font-medium text-emerald-100">Tire dúvidas ou agende com IA</span>
          </div>
        </button>
      )}

      {/* Expanded Chat Window */}
      {isOpen && (
        <div className="flex h-[520px] w-[360px] sm:w-[400px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-4 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-500/20 border border-teal-400/30 text-teal-300">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <Logo variant="white" size="sm" />
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-300">
                    Online 24h • Atendimento Inteligente
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-teal-600 text-white rounded-br-none shadow-xs font-medium"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-2xs whitespace-pre-line"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Optional CTA WhatsApp Button Recommendation */}
                {msg.recommendation && (
                  <div className="mt-2.5 w-[88%] rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 shadow-2xs space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Agendamento Direto no WhatsApp</span>
                    </div>

                    <a
                      href={msg.recommendation.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-emerald-700 active:scale-95"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>📲 Continuar Agendamento no WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-white p-3 rounded-2xl border border-slate-200 w-fit">
                <Bot className="h-4 w-4 text-teal-600 animate-spin" />
                <span>Consultando catálogo credenciado Conecta Saúde...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Footer Input */}
          <form onSubmit={handleSendMessage} className="border-t border-slate-200/80 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua dúvida ou exame desejado..."
                aria-label="Digite sua dúvida ou exame"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
              />
              <Button
                type="submit"
                size="sm"
                disabled={loading || !input.trim()}
                className="h-9 w-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white p-0 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { saveClinicWelcomeMessage } from "@/actions/admin";

const PLACEHOLDER = `Olá! Obrigado por entrar em contato com a [Nome da Clínica] 😊
Em instantes um dos nossos atendentes vai te responder por aqui mesmo.`;

export function WelcomeMessageModal({
  clinicId,
  clinicName,
  initialEnabled,
  initialText,
  onSaved,
}: {
  clinicId: string;
  clinicName: string;
  initialEnabled: boolean;
  initialText: string;
  onSaved: (enabled: boolean, text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setEnabled(initialEnabled);
      setText(initialText);
    }
  }

  async function handleSave() {
    if (enabled && !text.trim()) {
      toast.error("Escreva o texto da mensagem antes de ativar.");
      return;
    }
    setSaving(true);
    try {
      await saveClinicWelcomeMessage(clinicId, enabled, text);
      onSaved(enabled && text.trim().length > 0, text.trim());
      toast.success(enabled ? "Mensagem de boas-vindas ativada." : "Mensagem de boas-vindas desativada.");
      setOpen(false);
    } catch {
      toast.error("Erro ao salvar a mensagem de boas-vindas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all cursor-pointer">
        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
        <span>Boas-vindas</span>
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Mensagem de boas-vindas — {clinicName}
          </DialogTitle>
          <p className="text-xs text-slate-500 font-medium">
            Enviada automaticamente uma única vez, quando um cliente novo escreve pela
            primeira vez. Como quem inicia a conversa é o cliente, isso está dentro das
            regras da Meta (janela de atendimento de 24h) — não precisa de template
            aprovado. Clientes que já conversaram antes não recebem de novo.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <button
            type="button"
            onClick={() => setEnabled((prev) => !prev)}
            className={`w-full inline-flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
              enabled
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            <span>{enabled ? "Ativada" : "Desativada"}</span>
            <span
              className={`w-9 h-5 rounded-full relative transition-colors ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  enabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Texto da mensagem
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={5}
              className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
            />
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl transition-all"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

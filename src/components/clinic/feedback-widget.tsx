"use client";

import { useState } from "react";
import { MessageSquarePlus, Loader2, Image as ImageIcon, X, Bug, Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { submitFeedbackReport } from "@/actions/feedback";
import type { FeedbackType } from "@/lib/feedback";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("SUGGESTION");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function reset() {
    setType("SUGGESTION");
    setDescription("");
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImage(null);
    setImagePreviewUrl(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleImageSelect(file: File) {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    if (description.trim().length < 5) {
      toast.error("Descreva com um pouco mais de detalhe.");
      return;
    }
    setSending(true);
    try {
      const formData = new FormData();
      formData.set("type", type);
      formData.set("description", description.trim());
      if (image) formData.set("image", image);

      const result = await submitFeedbackReport(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Enviado! Obrigado pelo retorno.");
      handleOpenChange(false);
    } catch {
      toast.error("Erro ao enviar. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="fixed bottom-5 right-5 z-50 inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer print:hidden"
        title="Enviar sugestão ou reportar bug"
        aria-label="Enviar sugestão ou reportar bug"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </DialogTrigger>

      <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            Sugestão ou bug?
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Manda direto pra equipe técnica. Pode anexar um print se ajudar a explicar.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("SUGGESTION")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                type === "SUGGESTION"
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" /> Sugestão
            </button>
            <button
              type="button"
              onClick={() => setType("BUG")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                type === "BUG"
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Bug className="w-3.5 h-3.5" /> Bug
            </button>
          </div>

          <div>
            <label htmlFor="feedback-description" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Descrição
            </label>
            <textarea
              id="feedback-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "BUG" ? "O que aconteceu? Em qual tela?" : "O que você gostaria que tivesse ou funcionasse diferente?"}
              className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
            />
          </div>

          <div>
            {imagePreviewUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreviewUrl} alt="Prévia do print anexado" className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                    setImage(null);
                    setImagePreviewUrl(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400"
                >
                  <X className="w-3.5 h-3.5" /> Remover
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-700 dark:text-violet-300 cursor-pointer">
                <ImageIcon className="w-3.5 h-3.5" /> Anexar print (opcional)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                />
              </label>
            )}
          </div>

          <button
            type="button"
            disabled={sending}
            onClick={handleSubmit}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl transition-all"
          >
            {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

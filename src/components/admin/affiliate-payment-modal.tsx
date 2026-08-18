"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { DollarSign, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerAffiliatePaymentAction } from "@/actions/affiliates";
import { formatCurrency } from "@/lib/format";

interface AffiliatePaymentModalProps {
  affiliateId: string;
  affiliateName: string;
  availableBalance: number;
  totalEarned: number;
  totalPaid: number;
  pixKey: string;
  pixType: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AffiliatePaymentModal({
  affiliateId,
  affiliateName,
  availableBalance,
  totalEarned,
  totalPaid,
  pixKey,
  pixType,
  isOpen,
  onClose,
}: AffiliatePaymentModalProps) {
  const [amount, setAmount] = useState(availableBalance.toString());
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Informe um valor válido maior que zero.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerAffiliatePaymentAction(affiliateId, parsedAmount, notes);
      toast.success(`Pagamento PIX de ${formatCurrency(parsedAmount)} registrado com sucesso!`);
      onClose();
    } catch {
      toast.error("Falha ao registrar pagamento PIX.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 font-bold text-emerald-700 shadow-2xs">
              <DollarSign className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Registrar Pagamento PIX</h3>
              <p className="text-xs text-slate-500">{affiliateName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Chave PIX ({pixType}):</span>
              <span className="font-mono font-bold text-slate-800">{pixKey}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200/60 pt-2">
              <span className="text-slate-500 font-medium">Total Liberado (Comissões):</span>
              <span className="font-mono text-slate-700 font-semibold">{formatCurrency(totalEarned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Total Já Pago Anteriormente:</span>
              <span className="font-mono text-slate-700 font-semibold">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200/60 pt-2">
              <span className="font-bold text-emerald-800">Saldo Disponível para Saque:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                {formatCurrency(availableBalance)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 font-mono">
              Valor do Repasse (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono font-bold text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 font-mono">
              Observação / Comprovante (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Transferência PIX banco X - ID 12345"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 font-semibold"
            >
              <CheckCircle2 className="size-4" />
              {isSubmitting ? "Registrando..." : "Confirmar Repasse PIX"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

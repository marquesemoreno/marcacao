"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Copy, Check, DollarSign, CheckCircle2, Ban, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateAffiliateStatusAction } from "@/actions/affiliates";
import { AffiliatePaymentModal } from "./affiliate-payment-modal";
import type { AffiliateStatus } from "@prisma/client";

interface AffiliateActionsCellProps {
  affiliateId: string;
  affiliateName: string;
  phone: string;
  pixKey: string;
  pixTypeLabel: string;
  status: AffiliateStatus;
  totalEarned: number;
  totalPaid: number;
  availableBalance: number;
}

export function AffiliateActionsCell({
  affiliateId,
  affiliateName,
  phone,
  pixKey,
  pixTypeLabel,
  status,
  totalEarned,
  totalPaid,
  availableBalance,
}: AffiliateActionsCellProps) {
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const cleanPhone = phone.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/55${cleanPhone}`;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    toast.success("Chave PIX copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (newStatus: AffiliateStatus) => {
    setIsUpdatingStatus(true);
    try {
      await updateAffiliateStatusAction(affiliateId, newStatus);
      const actionText =
        newStatus === "ACTIVE"
          ? "aprovado/reativado"
          : "suspenso";
      toast.success(`Status do marcador ${actionText} com sucesso!`);
    } catch {
      toast.error("Falha ao atualizar status do marcador.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Botões de Status */}
      {status === "PENDING" && (
        <Button
          size="sm"
          variant="outline"
          disabled={isUpdatingStatus}
          onClick={() => handleStatusChange("ACTIVE")}
          className="h-8 gap-1 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 font-semibold"
        >
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          Aprovar
        </Button>
      )}

      {status === "ACTIVE" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={isUpdatingStatus}
          onClick={() => handleStatusChange("SUSPENDED")}
          className="h-8 gap-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
          title="Suspender Marcador"
        >
          <Ban className="size-3.5 text-rose-500" />
          Suspender
        </Button>
      )}

      {status === "SUSPENDED" && (
        <Button
          size="sm"
          variant="outline"
          disabled={isUpdatingStatus}
          onClick={() => handleStatusChange("ACTIVE")}
          className="h-8 gap-1 border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 font-semibold"
        >
          <RefreshCw className="size-3.5 text-sky-600" />
          Reativar
        </Button>
      )}

      {/* Botão WhatsApp */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
        title="Chamar marcador no WhatsApp"
      >
        <MessageSquare className="size-3.5 text-emerald-600 fill-current" />
        WhatsApp
      </a>

      {/* Copiar PIX */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopyPix}
        className="h-8 gap-1 text-xs text-slate-700 hover:bg-slate-100"
        title={`Copiar Chave PIX (${pixTypeLabel})`}
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-slate-500" />}
        Copiar PIX
      </Button>

      {/* Registrar Pagamento PIX */}
      <Button
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs"
      >
        <DollarSign className="size-3.5" />
        Registrar Pagamento PIX
      </Button>

      <AffiliatePaymentModal
        affiliateId={affiliateId}
        affiliateName={affiliateName}
        availableBalance={availableBalance}
        totalEarned={totalEarned}
        totalPaid={totalPaid}
        pixKey={pixKey}
        pixType={pixTypeLabel}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

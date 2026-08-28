"use client";

import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, MapPin, Phone, Printer, AlertTriangle } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";
import {
  formatCurrency,
  formatDate,
  maskCpf,
  appointmentStatusLabels,
  appointmentStatusVariant,
} from "@/lib/format";
import type { PlainAppointment } from "@/lib/serialize";

function guideCode(appointment: PlainAppointment) {
  const year = new Date(appointment.createdAt).getUTCFullYear();
  const suffix = appointment.id.slice(-5).toUpperCase();
  return `VDC-${year}-${suffix}`;
}

export function VoucherCard({
  appointment,
  comprovanteUrl,
  variant = "full",
}: {
  appointment: PlainAppointment;
  comprovanteUrl: string;
  variant?: "full" | "validation";
}) {
  const { clinicProcedure } = appointment;
  const { clinic, procedure } = clinicProcedure;
  const numPrice = clinicProcedure.promotionalPrice ?? clinicProcedure.price;
  const isSobConsulta = !numPrice || Number(numPrice) <= 0;
  const fullAddress = `${clinic.address}, ${clinic.neighborhood}, ${clinic.city}`;
  const when = appointment.timeSlot
    ? `${formatDate(appointment.date)} às ${appointment.timeSlot}`
    : formatDate(appointment.date);

  const shareMessage = [
    `Guia de encaminhamento ${guideCode(appointment)}`,
    `${procedure.name} — ${clinic.tradeName}`,
    when,
    comprovanteUrl,
  ].join("\n");

  return (
    <div
      id="voucher-card"
      className="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-3xl border-2 border-dashed border-teal-300 bg-white p-5 sm:p-7 shadow-sm print:max-w-full print:border-black print:p-4 print:shadow-none print:break-inside-avoid text-left"
    >
      {variant === "validation" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-xs font-bold">Guia Autêntica de Encaminhamento</p>
            <p className="text-[11px] text-emerald-700">Emitida pela plataforma Conecta Saúde — encaminhamento válido.</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <Logo variant="full" size="sm" />
          <p className="mt-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Guia Oficial de Encaminhamento
          </p>
          <p className="font-mono text-base sm:text-lg font-bold text-teal-800">#{guideCode(appointment)}</p>
        </div>
        <Badge variant={appointmentStatusVariant[appointment.status]}>
          {appointmentStatusLabels[appointment.status]}
        </Badge>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3 space-y-0.5">
        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Paciente</p>
        <p className="font-bold text-slate-900 text-sm sm:text-base">{appointment.patientName}</p>
        <p className="text-xs font-mono text-slate-500">CPF: {maskCpf(appointment.patientCpf)}</p>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3 space-y-0.5">
        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Clínica Parceira</p>
        <p className="font-bold text-slate-900 text-sm sm:text-base">{clinic.tradeName}</p>
        <p className="flex items-start gap-1.5 text-xs text-slate-600 mt-0.5">
          <MapPin className="mt-0.5 size-3.5 text-teal-600 shrink-0" />
          {fullAddress}
        </p>
        {clinic.phone && (
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <Phone className="size-3.5 text-teal-600 shrink-0" />
            {clinic.phone}
          </p>
        )}
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3 space-y-0.5">
        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Procedimento & Atendimento</p>
        <p className="font-bold text-slate-900 text-sm sm:text-base">{procedure.name}</p>
        <p className="text-xs text-slate-600">{when}</p>
        
        {isSobConsulta ? (
          <p className="text-xs sm:text-sm font-semibold text-emerald-800 pt-1">
            Valor: Sob consulta (negociado diretamente com a clínica via WhatsApp/recepção)
          </p>
        ) : (
          <p className="text-base sm:text-lg font-mono font-extrabold text-teal-700 pt-0.5">{formatCurrency(numPrice)}</p>
        )}
      </div>

      {procedure.preparationInstructions && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900 border border-amber-200/80">
          <AlertTriangle className="mt-0.5 size-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-950">Instruções de Preparo</p>
            <p className="text-xs text-amber-900 leading-snug">{procedure.preparationInstructions}</p>
          </div>
        </div>
      )}

      {variant === "full" && (
        <>
          <div className="flex flex-col items-center gap-2 border-t border-dashed border-slate-200 pt-3">
            <QRCodeSVG value={comprovanteUrl} size={120} level="M" />
            <p className="text-center text-[10px] font-mono text-slate-400">
              Aponte a câmera para validar esta guia na recepção da clínica
            </p>
          </div>

          <div className="flex flex-col gap-2 print:hidden sm:flex-row pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 gap-1.5 text-xs font-semibold rounded-xl border-slate-300"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Imprimir / Salvar PDF
            </Button>
            <Button
              render={
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              nativeButton={false}
              className="h-10 flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs"
            >
              <WhatsAppIcon className="size-3.5" />
              Enviar no WhatsApp
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

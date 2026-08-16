"use client";

import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, MapPin, Phone, Printer, MessageCircle, AlertTriangle } from "lucide-react";
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
  const price = clinicProcedure.promotionalPrice ?? clinicProcedure.price;
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
      className="mx-auto flex w-full max-w-lg flex-col gap-5 rounded-3xl border-2 border-dashed border-sky-300 bg-white p-6 shadow-sm print:max-w-full print:border-black print:shadow-none sm:p-8"
    >
      {variant === "validation" && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Guia autêntica</p>
            <p className="text-xs">Emitida pela plataforma Conecta Saúde — encaminhamento válido.</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <Logo variant="full" size="sm" />
          <p className="mt-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            Guia Oficial de Encaminhamento
          </p>
          <p className="font-mono text-lg font-bold text-sky-700">#{guideCode(appointment)}</p>
        </div>
        <Badge variant={appointmentStatusVariant[appointment.status]}>
          {appointmentStatusLabels[appointment.status]}
        </Badge>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Paciente</p>
        <p className="font-semibold text-slate-900">{appointment.patientName}</p>
        <p className="text-sm text-slate-500">CPF: {maskCpf(appointment.patientCpf)}</p>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Clínica parceira</p>
        <p className="font-semibold text-slate-900">{clinic.tradeName}</p>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          {fullAddress}
        </p>
        {clinic.phone && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Phone className="h-4 w-4 shrink-0" />
            {clinic.phone}
          </p>
        )}
      </div>

      <div className="border-t border-dashed border-slate-200 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Procedimento</p>
        <p className="font-semibold text-slate-900">{procedure.name}</p>
        <p className="text-sm text-slate-500">{when}</p>
        <p className="mt-1 text-lg font-bold text-sky-700">{formatCurrency(price)}</p>
      </div>

      {procedure.preparationInstructions && (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Instruções de preparo</p>
            <p className="text-sm">{procedure.preparationInstructions}</p>
          </div>
        </div>
      )}

      {variant === "full" && (
        <>
          <div className="flex flex-col items-center gap-2 border-t border-dashed border-slate-200 pt-4">
            <QRCodeSVG value={comprovanteUrl} size={140} level="M" />
            <p className="text-center text-xs text-slate-400">
              Aponte a câmera para validar esta guia na recepção
            </p>
          </div>

          <div className="flex flex-col gap-2 print:hidden sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 gap-2"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
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
              className="h-11 flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar Guia no WhatsApp
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

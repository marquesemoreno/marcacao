import type {
  AppointmentStatus,
  AppointmentType,
  PartnerLeadStatus,
  ProcedureCategory,
} from "@prisma/client";

export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value)
  );
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(date)
  );
}

export function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

/** Mostra só os 3 primeiros e os 2 últimos dígitos do CPF — usado na guia de encaminhamento. */
export function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.***.**${digits[8]}-${digits.slice(9)}`;
}

/** URL base da aplicação, para montar links absolutos (QR Code, WhatsApp, etc.). */
export function getBaseUrl() {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Link `wa.me` a partir de um telefone brasileiro (com ou sem DDI 55) e uma mensagem opcional. */
export function buildWhatsAppLink(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountryCode}${text}`;
}

export const categoryLabels: Record<ProcedureCategory, string> = {
  CONSULTATION: "Consulta",
  EXAM: "Exame",
  SURGERY: "Cirurgia",
};

export const appointmentTypeLabels: Record<AppointmentType, string> = {
  SCHEDULED: "Horário marcado",
  ARRIVAL_ORDER: "Ordem de chegada",
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  PENDING: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Falta",
};

export const appointmentStatusVariant: Record<
  AppointmentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  CONFIRMED: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

export const partnerLeadStatusLabels: Record<PartnerLeadStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Em contato",
  PARTNER: "Parceiro",
  REJECTED: "Recusado",
};

export const partnerLeadStatusVariant: Record<
  PartnerLeadStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  NEW: "secondary",
  CONTACTED: "outline",
  PARTNER: "default",
  REJECTED: "destructive",
};

import type { AppointmentStatus, AppointmentType, ProcedureCategory } from "@prisma/client";

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

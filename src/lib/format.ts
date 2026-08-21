import type {
  AppointmentStatus,
  AppointmentType,
  PartnerLeadStatus,
  ProcedureCategory,
  PixKeyType,
  AffiliateStatus,
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

/** Substitui tags dinâmicas como {{nome}}, {{clinica}}, {{procedimento}}, {{data}} nas mensagens de notificação. */
export function applyMessageVariables(
  template: string,
  vars: { nome?: string; clinica?: string; procedimento?: string; data?: string }
) {
  let result = template;
  if (vars.nome) result = result.replace(/\{\{\s*nome\s*\}\}/gi, vars.nome);
  if (vars.clinica) result = result.replace(/\{\{\s*clinica\s*\}\}/gi, vars.clinica);
  if (vars.procedimento) result = result.replace(/\{\{\s*procedimento\s*\}\}/gi, vars.procedimento);
  if (vars.data) result = result.replace(/\{\{\s*data\s*\}\}/gi, vars.data);
  return result;
}

/** Domínio oficial de produção — usado nos links absolutos (QR Code, WhatsApp, metadata). */
const PRODUCTION_URL = "https://conectasaudevc.com.br";

/**
 * URL base da aplicação, para montar links absolutos (QR Code, WhatsApp,
 * link de acompanhamento, etc.). Nunca usa `new URL(...)` — só concatenação
 * de string — porque `NEXTAUTH_URL` pode chegar ausente, com aspas ou sem
 * esquema em builds da Vercel, e um `new URL()` mal formado derruba o build
 * inteiro (`ERR_INVALID_URL`) quando essa função roda durante a geração
 * estática de uma rota que não devia ter sido pré-renderizada.
 *
 * Em produção (`VERCEL_ENV === "production"`) o domínio oficial tem
 * prioridade sobre `VERCEL_URL` de propósito: `VERCEL_URL` é sempre a URL
 * de deploy gerada automaticamente (ex. `marcacao-six.vercel.app`), não o
 * domínio customizado — se `VERCEL_URL` viesse primeiro, os links de QR
 * Code/WhatsApp nunca mostrariam o domínio oficial mesmo depois de
 * configurado na Vercel. Em preview deployments (`VERCEL_ENV === "preview"`)
 * mantém `VERCEL_URL`, para que cada branch/PR aponte pra sua própria URL.
 */
export function getBaseUrl() {
  if (typeof window !== "undefined") return "";

  if (process.env.VERCEL_ENV === "production") return PRODUCTION_URL;

  let url: string;
  if (process.env.VERCEL_URL) {
    url = `https://${process.env.VERCEL_URL}`;
  } else if (process.env.NEXTAUTH_URL) {
    const raw = process.env.NEXTAUTH_URL.replace(/["']/g, "").trim();
    url = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  } else {
    url = "http://localhost:3000";
  }
  return url.replace(/\/+$/, "");
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

export const pixKeyTypeLabels: Record<PixKeyType, string> = {
  CPF: "CPF",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  RANDOM: "Chave aleatória",
};

export const affiliateStatusLabels: Record<AffiliateStatus, string> = {
  ACTIVE: "Ativo",
  PENDING: "Aguardando aprovação",
  SUSPENDED: "Suspenso",
};

export const affiliateStatusVariant: Record<
  AffiliateStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  PENDING: "secondary",
  SUSPENDED: "destructive",
};

/** Tamanho legível ("284 KB", "1.4 MB") — usado tanto no upload de mídia do WhatsApp (servidor) quanto na prévia do composer (cliente). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

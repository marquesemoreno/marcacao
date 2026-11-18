/** Atestado de anonimização (LGPD art. 18, VI): prova de que a exclusão a pedido do titular foi
 * feita, sem nenhum dado do titular — nem mascarado. O código de autenticidade é um HMAC dos
 * campos do atestado com um segredo do servidor; qualquer pessoa confere em /verificar-atestado. */
import { createHmac, timingSafeEqual } from "node:crypto";

export type CertificateFields = {
  /** Id do DataDeletionRecord. */
  protocol: string;
  /** Razão social da clínica. */
  clinicName: string;
  clinicCnpj: string;
  /** ISO, em UTC. */
  performedAt: string;
  /** Nome de quem executou (equipe de suporte). */
  performedBy: string;
  performedFromIp: string | null;
  messagesDeleted: number;
  contactAnonymized: boolean;
};

/** Segredo do HMAC: LGPD_CERTIFICATE_SECRET, ou o NEXTAUTH_SECRET que já existe. */
export function certificateSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.LGPD_CERTIFICATE_SECRET || env.NEXTAUTH_SECRET || "";
}

function canonical(f: CertificateFields): string {
  return JSON.stringify([f.protocol, f.clinicName, f.clinicCnpj, f.performedAt, f.performedBy, f.performedFromIp ?? "", f.messagesDeleted, f.contactAnonymized]);
}

/** "A1B2-C3D4-E5F6-0718-293A" — 80 bits do HMAC-SHA256. */
export function certificateCode(f: CertificateFields, secret: string): string {
  if (!secret) throw new Error("Segredo do atestado não configurado.");
  const hex = createHmac("sha256", secret).update(canonical(f)).digest("hex").slice(0, 20).toUpperCase();
  return hex.match(/.{4}/g)!.join("-");
}

/** Código digitado pela pessoa → forma guardada no banco. null = não parece um código. */
export function normalizeCertificateCode(input: string): string | null {
  const hex = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[0-9A-F]{20}$/.test(hex)) return null;
  return hex.match(/.{4}/g)!.join("-");
}

export function sameCertificateCode(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
}

/** Data e hora em Brasília (UTC-3, sem horário de verão). */
export function brasiliaDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 16)}`;
}

/** Texto do atestado, linha a linha (a página e o teste usam o mesmo). */
export function certificateLines(f: CertificateFields, code: string, verifyUrl = "/verificar-atestado"): string[] {
  return [
    "ATESTADO DE ANONIMIZAÇÃO DE DADOS PESSOAIS",
    "",
    `Controladora: ${f.clinicName}, CNPJ ${formatCnpj(f.clinicCnpj)}.`,
    `Protocolo: ${f.protocol}`,
    `Data e hora da execução: ${brasiliaDateTime(f.performedAt)} (horário de Brasília)`,
    `Executado por: ${f.performedBy}`,
    `Endereço IP de origem: ${f.performedFromIp ?? "não registrado"}`,
    "",
    "Atestamos que, a pedido do titular (Lei 13.709/2018, art. 18), os dados pessoais dele nesta clínica foram excluídos ou anonimizados no sistema de atendimento:",
    `- mensagens e mídias da conversa apagadas (${f.messagesDeleted} mensagens), inclusive as cópias de segurança;`,
    "- cadastro na clínica, ficha prévia, tarefas, avaliações e registros de fila apagados;",
    f.contactAnonymized
      ? "- nome e telefone do titular anonimizados no cadastro geral;"
      : "- o cadastro geral foi mantido porque o titular conversa com outra clínica (os dados desta clínica foram apagados).",
    "Agendamentos foram mantidos, por serem registro de atendimento com guarda obrigatória.",
    "",
    "Este atestado não contém nenhum dado do titular.",
    `Código de autenticidade: ${code}`,
    `Confira em ${verifyUrl}`,
  ];
}

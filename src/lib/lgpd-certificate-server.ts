import "server-only";
import { prisma } from "@/lib/prisma";
import { certificateCode, certificateSecret, normalizeCertificateCode, sameCertificateCode, type CertificateFields } from "@/lib/lgpd-certificate";

type RecordRow = {
  id: string;
  clinicId: string;
  createdAt: Date;
  performedByUserId: string;
  performedFromIp: string | null;
  messagesDeleted: number;
  contactAnonymized: boolean;
};

/** Campos do atestado a partir do registro da exclusão (sem nenhum dado do titular). */
export async function certificateFieldsOf(record: RecordRow): Promise<CertificateFields> {
  const [clinic, user] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: record.clinicId }, select: { name: true, cnpj: true } }),
    prisma.user.findUnique({ where: { id: record.performedByUserId }, select: { name: true } }),
  ]);
  return {
    protocol: record.id,
    clinicName: clinic?.name ?? "—",
    clinicCnpj: clinic?.cnpj ?? "",
    performedAt: record.createdAt.toISOString(),
    performedBy: user?.name ?? "Equipe de suporte",
    performedFromIp: record.performedFromIp,
    messagesDeleted: record.messagesDeleted,
    contactAnonymized: record.contactAnonymized,
  };
}

/** Calcula e grava o código do atestado. null = sem segredo configurado (a exclusão vale do
 * mesmo jeito; o atestado sai depois, com o segredo). */
export async function issueCertificate(recordId: string): Promise<string | null> {
  const secret = certificateSecret();
  if (!secret) return null;
  const record = await prisma.dataDeletionRecord.findUnique({ where: { id: recordId } });
  if (!record) return null;
  const code = certificateCode(await certificateFieldsOf(record), secret);
  await prisma.dataDeletionRecord.update({ where: { id: recordId }, data: { certificateCode: code } });
  return code;
}

/** Conferência pública do atestado: só diz se vale, de qual clínica, quando e o protocolo. */
export async function verifyCertificateCode(
  input: string,
): Promise<{ valid: false } | { valid: true; protocol: string; clinicName: string; performedAt: string }> {
  const code = normalizeCertificateCode(input);
  const secret = certificateSecret();
  if (!code || !secret) return { valid: false };
  const record = await prisma.dataDeletionRecord.findUnique({ where: { certificateCode: code } });
  if (!record?.certificateCode) return { valid: false };
  const fields = await certificateFieldsOf(record);
  if (!sameCertificateCode(certificateCode(fields, secret), code)) return { valid: false };
  return { valid: true, protocol: fields.protocol, clinicName: fields.clinicName, performedAt: fields.performedAt };
}

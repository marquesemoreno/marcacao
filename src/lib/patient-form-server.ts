import { errorSummary } from "@/lib/safe-error";
import "server-only";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { parseFormTemplate, type FormTemplateBody } from "@/lib/patient-form";
import { DEFAULT_CONSENT_TERM, formLinkLine } from "@/lib/patient-journey";
import { getBaseUrl } from "@/lib/format";

/** Respostas da ficha prévia são dado de saúde: sempre criptografadas em repouso. */
export function encryptFormAnswers(answers: Record<string, string>): string {
  return encryptToken(JSON.stringify(answers));
}

export function decryptFormAnswers(stored: string): Record<string, string> {
  return JSON.parse(decryptToken(stored));
}

/** IP do aceite só como hash (prova de aceite sem guardar o IP em claro). */
export function hashIp(ip: string | null): string | null {
  return ip ? createHash("sha256").update(`conecta-consent:${ip}`).digest("hex") : null;
}

/** Modelo ativo mais recente da clínica (null = clínica ainda não configurou a ficha). */
export async function getActiveFormTemplate(clinicId: string, kind = "ANAMNESE"): Promise<{ id: string; version: number; name: string; body: FormTemplateBody } | null> {
  const t = await prisma.formTemplate.findFirst({
    where: { clinicId, kind, active: true },
    orderBy: { version: "desc" },
  });
  if (!t) return null;
  return { id: t.id, version: t.version, name: t.name, body: parseFormTemplate(t.body) };
}

/** Termo vigente: o da clínica se houver, senão o padrão do Conecta (clinicId null). */
export async function getCurrentConsentTerm(clinicId: string, kind: string) {
  const own = await prisma.consentTerm.findFirst({ where: { clinicId, kind }, orderBy: { version: "desc" } });
  return own ?? prisma.consentTerm.findFirst({ where: { clinicId: null, kind }, orderBy: { version: "desc" } });
}

/** Termo vigente, criando o padrão do Conecta (v1) na primeira vez. */
export async function ensureConsentTerm(clinicId: string, kind = "ANAMNESE") {
  const current = await getCurrentConsentTerm(clinicId, kind);
  if (current) return current;
  return prisma.consentTerm.create({
    data: { clinicId: null, kind, version: DEFAULT_CONSENT_TERM.version, title: DEFAULT_CONSENT_TERM.title, body: DEFAULT_CONSENT_TERM.body },
  });
}

/** Linha com o link da ficha pro lembrete da véspera, ou null (clínica sem ficha ativa,
 * ou qualquer falha — o lembrete sai sem a linha, nunca deixa de sair). */
export async function formLinkForReminder(input: {
  clinicId: string;
  phone: string;
  appointment: { source: "BRIDGE" | "LOCAL"; externalId: string; date: string };
}): Promise<string | null> {
  try {
    const template = await prisma.formTemplate.findFirst({ where: { clinicId: input.clinicId, kind: "ANAMNESE", active: true }, select: { id: true } });
    if (!template) return null;
    const { issuePatientToken } = await import("@/lib/patient-token-server");
    const { raw } = await issuePatientToken({ clinicId: input.clinicId, kind: "ANAMNESE", phone: input.phone, appointment: input.appointment });
    return formLinkLine(`${getBaseUrl()}/p/${raw}`);
  } catch (e) {
    console.error("[ficha] não gerou o link do lembrete", errorSummary(e));
    return null;
  }
}

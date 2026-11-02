import "server-only";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { parseFormTemplate, type FormTemplateBody } from "@/lib/patient-form";

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

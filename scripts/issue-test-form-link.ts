/** Gera um link de TESTE da ficha prévia (/p/<token>) sem mandar mensagem pra ninguém.
 * Grava só um PatientToken amarrado a uma consulta fictícia (externalId "TESTE-…").
 * A clínica precisa ter a ficha ativa em /clinic/ficha.
 *
 * Uso (PowerShell):
 *   npx tsx scripts/issue-test-form-link.ts                      # lista clínicas e se a ficha está ativa
 *   npx tsx scripts/issue-test-form-link.ts --clinic <clinicId> [--phone 5577999999999] [--date 2026-11-03]
 * Sem --date usa hoje (o botão "Cheguei" só aparece no dia da consulta). */
import { PrismaClient } from "@prisma/client";
import { newPatientToken } from "../src/lib/patient-token";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const prisma = new PrismaClient();

async function main() {
  const clinicId = flag("clinic");
  if (!clinicId) {
    const clinics = await prisma.clinic.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    const active = await prisma.formTemplate.findMany({ where: { kind: "ANAMNESE", active: true }, select: { clinicId: true } });
    const on = new Set(active.map((t) => t.clinicId));
    for (const c of clinics) console.log(`${c.id}  ${on.has(c.id) ? "ficha ATIVA " : "ficha off   "}  ${c.name}`);
    return;
  }
  const template = await prisma.formTemplate.findFirst({ where: { clinicId, kind: "ANAMNESE", active: true }, select: { id: true } });
  if (!template) throw new Error("Essa clínica não tem ficha ativa — ative em /clinic/ficha primeiro.");
  const date = flag("date") ?? new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const t = newPatientToken("ANAMNESE");
  await prisma.patientToken.create({
    data: {
      clinicId,
      kind: "ANAMNESE",
      tokenHash: t.tokenHash,
      phone: flag("phone") ?? null,
      appointmentSource: "LOCAL",
      appointmentExternalId: `TESTE-${Date.now()}`,
      appointmentDate: new Date(`${date}T00:00:00Z`),
      expiresAt: t.expiresAt,
    },
  });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://www.conectasaudevc.com.br";
  console.log(`${base.replace(/\/$/, "")}/p/${t.raw}`);
  console.log(`vale até ${t.expiresAt.toISOString()} · consulta fictícia em ${date}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

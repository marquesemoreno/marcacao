"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicSession, requireClinicPermission } from "@/lib/session";
import { parseFormTemplate, type FormQuestion } from "@/lib/patient-form";
import { DEFAULT_ANAMNESE_TEMPLATE } from "@/lib/patient-journey";
import { decryptFormAnswers, ensureConsentTerm } from "@/lib/patient-form-server";
import { recordAudit } from "@/lib/audit-server";
import { recordPatientAccess } from "@/lib/access-log-server";
import { readAppointmentFormResponse } from "@/lib/patient-form-view-server";

/** Ficha prévia — lado da clínica: configurar (gestão) e ver as respostas (com registro
 * de acesso, LGPD). */

export async function getFormSettings() {
  const { clinicId } = await requireClinicManager();
  const latest = await prisma.formTemplate.findFirst({ where: { clinicId, kind: "ANAMNESE" }, orderBy: { version: "desc" } });
  const term = await ensureConsentTerm(clinicId);
  return {
    active: latest?.active ?? false,
    version: latest?.version ?? 0,
    questions: latest ? parseFormTemplate(latest.body).questions : DEFAULT_ANAMNESE_TEMPLATE.questions,
    isDefault: !latest,
    term: { title: term.title, body: term.body, version: term.version, isDefault: term.clinicId === null },
  };
}

/** Salva como nova versão (respostas antigas continuam ligadas à versão que o paciente viu). */
export async function saveFormTemplate(input: { questions: FormQuestion[]; active: boolean }) {
  const { clinicId, userId } = await requireClinicManager();
  const body = parseFormTemplate({ questions: input.questions });
  const latest = await prisma.formTemplate.findFirst({ where: { clinicId, kind: "ANAMNESE" }, orderBy: { version: "desc" } });
  const sameBody = latest && JSON.stringify(latest.body) === JSON.stringify(body);
  if (sameBody) {
    if (latest.active !== input.active) await prisma.formTemplate.update({ where: { id: latest.id }, data: { active: input.active } });
  } else {
    await prisma.$transaction([
      prisma.formTemplate.updateMany({ where: { clinicId, kind: "ANAMNESE", active: true }, data: { active: false } }),
      prisma.formTemplate.create({
        data: { clinicId, kind: "ANAMNESE", name: "Ficha prévia", version: (latest?.version ?? 0) + 1, body: body as Prisma.InputJsonValue, active: input.active },
      }),
    ]);
  }
  await recordAudit({
    clinicId,
    userId,
    action: "form.template",
    entity: "form_template",
    entityId: clinicId,
    before: latest ? { active: latest.active, version: latest.version } : null,
    after: { active: input.active, version: sameBody ? latest.version : (latest?.version ?? 0) + 1 },
  });
  revalidatePath("/clinic/ficha");
  return { success: true as const };
}

/** Respostas da ficha de uma consulta, já com o texto das perguntas. Abrir conta como
 * acesso a dado de saúde (PatientAccessLog, ou audit_logs quando não há conversa). */
export async function getAppointmentFormResponse(ref: { source: "BRIDGE" | "LOCAL"; externalId: string }) {
  const { clinicId, userId } = await requireClinicPermission("ficha.ver");
  return readAppointmentFormResponse(clinicId, userId, ref);
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { parseFormTemplate } from "@/lib/patient-form";
import { decryptFormAnswers } from "@/lib/patient-form-server";
import { recordAudit } from "@/lib/audit-server";
import { recordPatientAccess } from "@/lib/access-log-server";

/** Respostas da ficha de uma consulta, com o texto das perguntas. Abrir conta como acesso
 * a dado de saúde (PatientAccessLog, ou audit_logs quando não há conversa). Quem chama já
 * checou a permissão (equipe: "ficha.ver"; médico: paciente dele de hoje). */
export async function readAppointmentFormResponse(clinicId: string, userId: string, ref: { source: "BRIDGE" | "LOCAL"; externalId: string }) {
  const r = await prisma.patientFormResponse.findFirst({
    where: { clinicId, appointmentSource: ref.source, appointmentExternalId: ref.externalId },
    orderBy: { submittedAt: "desc" },
    include: { template: { select: { body: true, version: true } } },
  });
  if (!r) return null;
  const questions = parseFormTemplate(r.template.body).questions;
  const answers = decryptFormAnswers(r.answersEncrypted);
  const conversation = r.phone
    ? await prisma.conversation.findFirst({ where: { clinicId, contact: { phone: r.phone } }, select: { id: true } })
    : null;
  if (conversation) await recordPatientAccess({ clinicId, userId, conversationId: conversation.id, action: "VIU_FICHA_PREVIA" });
  else await recordAudit({ clinicId, userId, action: "form.view", entity: "patient_form_response", entityId: r.id, before: null, after: { viewed: true } });
  return {
    submittedAt: r.submittedAt.toISOString(),
    items: questions.filter((q) => answers[q.id] !== undefined).map((q) => ({ label: q.label, value: q.type === "yesno" ? (answers[q.id] === "sim" ? "Sim" : "Não") : answers[q.id] })),
  };
}

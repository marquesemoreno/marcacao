"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { getAutomationCloudSetup } from "@/actions/automation-rules";
import { checkTemplateParamSources } from "@/lib/broadcast-cloud-template";
import {
  MAX_TAG_AUTOMATIONS,
  REMINDER_TAG,
  sameTrigger,
  validateTagAutomation,
  type TagAutomationAction,
  type TagAutomationInput,
  type TagAutomationMode,
  type TagAutomationTrigger,
  type TagAutomationWaitFrom,
} from "@/lib/tag-automations";
import { resetBaseline } from "@/lib/tag-automations-run";
import { WRONG_NUMBER_TAG } from "@/lib/conversation-tags";

export type TagAutomationView = {
  id: string;
  name: string;
  triggerKind: TagAutomationTrigger;
  tag: string;
  stage: string | null;
  delayHours: number;
  waitFrom: TagAutomationWaitFrom;
  stopOnReply: boolean;
  action: TagAutomationAction;
  mode: TagAutomationMode;
  reminderText: string;
  cloudTemplateName: string | null;
  cloudTemplateParams: string[];
  active: boolean;
  /** Conversas com a tag esperando a hora de disparar. */
  pending: number;
  /** Conversas que viraram campanha ou lembrete nos últimos 30 dias. */
  done30d: number;
};

/** Automações da clínica + as tags em uso nas conversas (sugestões para o gatilho). */
export async function listTagAutomations(): Promise<{ automations: TagAutomationView[]; tags: string[] }> {
  const { clinicId } = await requireClinicPermission("disparos");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [rows, tagged] = await Promise.all([
    prisma.tagAutomation.findMany({ where: { clinicId }, orderBy: { createdAt: "asc" } }),
    prisma.conversation.findMany({ where: { clinicId, tags: { isEmpty: false } }, select: { tags: true } }),
  ]);
  const automations = await Promise.all(
    rows.map(async (r) => {
      const [pending, done30d] = await Promise.all([
        prisma.tagAutomationEnrollment.count({ where: { automationId: r.id, status: "PENDING" } }),
        prisma.tagAutomationEnrollment.count({ where: { automationId: r.id, status: "DONE", doneAt: { gte: since } } }),
      ]);
      return {
        id: r.id,
        name: r.name,
        triggerKind: r.triggerKind as TagAutomationTrigger,
        tag: r.tag,
        stage: r.stage,
        delayHours: r.delayHours,
        waitFrom: r.waitFrom as TagAutomationWaitFrom,
        stopOnReply: r.stopOnReply,
        action: r.action as TagAutomationAction,
        mode: r.mode as TagAutomationMode,
        reminderText: r.reminderText ?? "",
        cloudTemplateName: r.cloudTemplateName,
        cloudTemplateParams: r.cloudTemplateParams,
        active: r.active,
        pending,
        done30d,
      };
    }),
  );
  const tags = [...new Set(tagged.flatMap((c) => c.tags))].filter((t) => t !== WRONG_NUMBER_TAG && t !== REMINDER_TAG).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { automations, tags };
}

export async function saveTagAutomation(input: TagAutomationInput & { id?: string }) {
  const { clinicId } = await requireClinicPermission("disparos");
  const invalid = validateTagAutomation(input);
  if (invalid) return { success: false as const, error: invalid };

  // A automação editada tem que ser desta clínica.
  const current = input.id ? await prisma.tagAutomation.findFirst({ where: { id: input.id, clinicId } }) : null;
  if (input.id && !current) return { success: false as const, error: "Automação não encontrada." };
  if (!current && (await prisma.tagAutomation.count({ where: { clinicId } })) >= MAX_TAG_AUTOMATIONS) {
    return { success: false as const, error: `O limite é de ${MAX_TAG_AUTOMATIONS} automações por clínica.` };
  }

  let template: { name: string; language: string; bodyText: string; params: string[] } | null = null;
  if (input.action === "MESSAGE") {
    const cloud = await getAutomationCloudSetup();
    if (input.cloudTemplateName) {
      const tpl = cloud.templates.find((t) => t.name === input.cloudTemplateName);
      if (!tpl) return { success: false as const, error: "Modelo não encontrado entre os aprovados pela Meta." };
      const params = input.cloudTemplateParams.slice(0, tpl.variableCount).map((p) => p.trim());
      const problem = checkTemplateParamSources(tpl.variableCount, params, ["nome", "saudacao"]);
      if (problem) return { success: false as const, error: problem.replace("A planilha não tem a coluna", "Use só {{nome}} ou {{saudacao}} — não existe") };
      template = { name: tpl.name, language: tpl.language, bodyText: tpl.bodyText, params };
    }
    if (input.active) {
      if (!cloud.active) return { success: false as const, error: "Mensagem automática só liga com a API oficial do WhatsApp ativa (evita bloqueio do número)." };
      if (!template) return { success: false as const, error: "Escolha um modelo aprovado pela Meta antes de ligar." };
      if (input.mode === "AUTO") {
        const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { technicalDirectorName: true, technicalDirectorCrm: true } });
        if (!clinic.technicalDirectorName?.trim() || !clinic.technicalDirectorCrm?.trim()) {
          return { success: false as const, error: "Para enviar sozinho, cadastre o responsável técnico (nome e CRM) em Configurações." };
        }
      }
    }
  }

  const data = {
    name: input.name.trim(),
    triggerKind: input.triggerKind,
    tag: input.triggerKind === "TAG" ? input.tag.trim() : "",
    stage: input.triggerKind === "STAGE" ? input.stage : null,
    delayHours: input.delayHours,
    waitFrom: input.waitFrom,
    stopOnReply: input.stopOnReply,
    action: input.action,
    mode: input.mode,
    reminderText: input.action === "REMINDER" ? input.reminderText.trim() : null,
    cloudTemplateName: template?.name ?? null,
    cloudTemplateLanguage: template?.language ?? null,
    cloudTemplateBody: template?.bodyText ?? null,
    cloudTemplateParams: template?.params ?? [],
    active: input.active,
  };
  const saved = current
    ? await prisma.tagAutomation.update({ where: { id: current.id }, data })
    : await prisma.tagAutomation.create({ data: { clinicId, ...data } });

  // Ligou agora, ou trocou o gatilho com ela ligada: quem já está no gatilho não recebe nada.
  let alreadyTagged: number | null = null;
  if (saved.active && (!current?.active || !sameTrigger(current, saved))) {
    alreadyTagged = await resetBaseline({ id: saved.id, clinicId, triggerKind: saved.triggerKind, tag: saved.tag, stage: saved.stage }, new Date());
  }
  revalidatePath("/clinic/disparos");
  return { success: true as const, id: saved.id, alreadyTagged };
}

export async function deleteTagAutomation(id: string) {
  const { clinicId } = await requireClinicPermission("disparos");
  const { count } = await prisma.tagAutomation.deleteMany({ where: { id, clinicId } });
  if (count === 0) return { success: false as const, error: "Automação não encontrada." };
  revalidatePath("/clinic/disparos");
  return { success: true as const };
}

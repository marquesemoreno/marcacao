"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { DEFAULT_RULE_STEPS, validateRuleInput, type AutomationRuleKind } from "@/lib/automation-rules";
import { checkTemplateParamSources } from "@/lib/broadcast-cloud-template";
import { getClinicCloudBroadcastSetup } from "@/actions/clinic-broadcast";
import { revalidatePath } from "next/cache";
import { ruleAudience } from "@/lib/automation-rules-run";

export type AutomationRuleView = {
  kind: AutomationRuleKind;
  name: string;
  daysAfter: number;
  requireNoFuture: boolean;
  active: boolean;
  cloudTemplateName: string | null;
  cloudTemplateParams: string[];
  lastRunDate: string | null;
  /** Enviadas pelos últimos 30 dias de campanhas deste passo. */
  sent30d: number;
};

/** Os 3 passos da régua da clínica — os que ainda não foram salvos vêm com o padrão. */
export async function listAutomationRules(): Promise<AutomationRuleView[]> {
  const { clinicId } = await requireClinicPermission("disparos");
  const saved = await prisma.automationRule.findMany({ where: { clinicId } });
  const since = new Date(Date.now() - 30 * 86400000);
  return Promise.all(
    DEFAULT_RULE_STEPS.map(async (step) => {
      const rule = saved.find((r) => r.kind === step.kind);
      const sent30d = rule
        ? await prisma.broadcastRecipient.count({ where: { status: "SENT", sentAt: { gte: since }, campaign: { automationRuleId: rule.id } } })
        : 0;
      return {
        kind: step.kind,
        name: step.name,
        daysAfter: rule?.daysAfter ?? step.daysAfter,
        requireNoFuture: step.requireNoFuture,
        active: rule?.active ?? false,
        cloudTemplateName: rule?.cloudTemplateName ?? null,
        cloudTemplateParams: rule?.cloudTemplateParams ?? [],
        lastRunDate: rule?.lastRunDate ?? null,
        sent30d,
      };
    }),
  );
}

/** "Amanhã às 8h: ~N pacientes" — quantos entrariam no passo com os dias escolhidos.
 * Conta antes do consentimento de marketing (o envio ainda pula quem não aceitou). */
export async function previewAutomationRule(input: { kind: AutomationRuleKind; daysAfter: number }) {
  const { clinicId } = await requireClinicPermission("disparos");
  const step = DEFAULT_RULE_STEPS.find((s) => s.kind === input.kind);
  if (!step) return { ok: false as const, error: "Passo desconhecido." };
  if (input.kind !== "ANIVERSARIO" && validateRuleInput({ daysAfter: input.daysAfter })) return { ok: false as const, error: "Dias inválidos." };
  const integration = await prisma.hospitalIntegration.findUnique({ where: { clinicId }, select: { active: true } });
  if (!integration?.active) return { ok: false as const, error: "Sem sistema da clínica conectado." };
  const [rule, clinic] = await Promise.all([
    prisma.automationRule.findUnique({ where: { clinicId_kind: { clinicId, kind: input.kind } }, select: { id: true } }),
    prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { campaignExcludedPatientIds: true } }),
  ]);
  try {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const audience = await ruleAudience(
      { clinicId, ruleId: rule?.id ?? null, kind: input.kind, daysAfter: input.daysAfter, requireNoFuture: step.requireNoFuture, excludedPatientIds: clinic.campaignExcludedPatientIds },
      tomorrow,
    );
    return { ok: true as const, count: audience.length };
  } catch {
    return { ok: false as const, error: "O sistema da clínica não respondeu." };
  }
}

export async function saveAutomationRule(input: {
  kind: AutomationRuleKind;
  daysAfter: number;
  active: boolean;
  cloudTemplateName: string | null;
  cloudTemplateParams: string[];
}) {
  const { clinicId } = await requireClinicPermission("disparos");
  const step = DEFAULT_RULE_STEPS.find((s) => s.kind === input.kind);
  if (!step) return { success: false as const, error: "Passo desconhecido." };
  const invalid = input.kind === "ANIVERSARIO" ? null : validateRuleInput({ daysAfter: input.daysAfter });
  if (invalid) return { success: false as const, error: invalid };

  const cloud = await getClinicCloudBroadcastSetup();
  let template: { name: string; language: string; bodyText: string; params: string[] } | null = null;
  if (input.cloudTemplateName) {
    const tpl = cloud.templates.find((t) => t.name === input.cloudTemplateName);
    if (!tpl) return { success: false as const, error: "Modelo não encontrado entre os aprovados pela Meta." };
    const params = input.cloudTemplateParams.slice(0, tpl.variableCount).map((p) => p.trim());
    const problem = checkTemplateParamSources(tpl.variableCount, params, ["nome", "saudacao"]);
    if (problem) return { success: false as const, error: problem.replace("A planilha não tem a coluna", "Use só {{nome}} ou {{saudacao}} — não existe") };
    template = { name: tpl.name, language: tpl.language, bodyText: tpl.bodyText, params };
  }
  if (input.active) {
    if (!cloud.active) return { success: false as const, error: "A régua só liga com a API oficial do WhatsApp ativa (evita bloqueio do número)." };
    if (!template) return { success: false as const, error: "Escolha um modelo aprovado pela Meta antes de ligar." };
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { technicalDirectorName: true, technicalDirectorCrm: true } });
    if (!clinic.technicalDirectorName?.trim() || !clinic.technicalDirectorCrm?.trim()) {
      return { success: false as const, error: "Cadastre o responsável técnico (nome e CRM) em Configurações antes de ligar." };
    }
  }

  const data = {
    name: step.name,
    daysAfter: input.kind === "ANIVERSARIO" ? 0 : input.daysAfter,
    requireNoFuture: step.requireNoFuture,
    messageTemplate: step.messageTemplate,
    active: input.active,
    cloudTemplateName: template?.name ?? null,
    cloudTemplateLanguage: template?.language ?? null,
    cloudTemplateBody: template?.bodyText ?? null,
    cloudTemplateParams: template?.params ?? [],
  };
  await prisma.automationRule.upsert({
    where: { clinicId_kind: { clinicId, kind: input.kind } },
    create: { clinicId, kind: input.kind, ...data },
    update: data,
  });
  revalidatePath("/clinic/disparos");
  return { success: true as const };
}

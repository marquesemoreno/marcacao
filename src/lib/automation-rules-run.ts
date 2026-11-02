import { prisma } from "@/lib/prisma";
import { fetchBridgeCampaignPatients } from "@/lib/hospital-bridge";
import { buildCampaignAudience } from "@/lib/campaign-audience";
import { technicalDirectorLine } from "@/lib/broadcast-csv";
import { ruleCampaignName, ruleTargetDate } from "@/lib/automation-rules";

/** Quem já recebeu este mesmo passo nesse período não recebe de novo. */
const REPEAT_GUARD_DAYS = 30;

type RunResult = { ruleId: string; clinicId: string; name: string; status: string; recipients?: number };

async function logRun(r: RunResult) {
  await prisma.webhookLog
    .create({ data: { event: "automation_rule.run", payload: r, status: r.status === "criada" || r.status === "ninguém hoje" ? "SUCCESS" : "SKIPPED" } })
    .catch(() => {});
}

/** Roda uma vez por dia (cron 08h): cada passo ativo vira uma campanha RUNNING de baixa
 * prioridade com quem teve a última consulta há `daysAfter` dias. O envio em si é o do
 * dispatcher de Disparos (ritmo, janela, consentimento de marketing, opt-out). */
export async function runAutomationRules(now = new Date()): Promise<RunResult[]> {
  const today = ruleTargetDate(now, 0);
  const rules = await prisma.automationRule.findMany({
    where: { active: true, OR: [{ lastRunDate: null }, { lastRunDate: { not: today } }] },
    include: { clinic: { select: { technicalDirectorName: true, technicalDirectorCrm: true, campaignExcludedPatientIds: true } } },
  });
  const results: RunResult[] = [];
  for (const rule of rules) {
    const base = { ruleId: rule.id, clinicId: rule.clinicId, name: rule.name };
    const result = await runOne(rule, now).catch((e: unknown) => ({ ...base, status: `erro: ${e instanceof Error ? e.message : String(e)}` }));
    await prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunDate: today } });
    await logRun(result);
    results.push(result);
  }
  return results;
}

async function runOne(
  rule: Awaited<ReturnType<typeof prisma.automationRule.findMany>>[number] & {
    clinic: { technicalDirectorName: string | null; technicalDirectorCrm: string | null; campaignExcludedPatientIds: number[] };
  },
  now: Date,
): Promise<RunResult> {
  const base = { ruleId: rule.id, clinicId: rule.clinicId, name: rule.name };
  const cloud = await prisma.whatsappCloudAccount.findUnique({ where: { clinicId: rule.clinicId }, select: { active: true } });
  // Mensagem automática diária pela Evolution já bloqueou número 2× — só com a API oficial.
  if (!cloud?.active) return { ...base, status: "sem API oficial ativa" };
  if (!rule.cloudTemplateName) return { ...base, status: "sem modelo aprovado" };
  if (!technicalDirectorLine(rule.clinic.technicalDirectorName, rule.clinic.technicalDirectorCrm)) {
    return { ...base, status: "sem responsável técnico" };
  }
  const integration = await prisma.hospitalIntegration.findUnique({ where: { clinicId: rule.clinicId }, select: { active: true } });
  if (!integration?.active) return { ...base, status: "sem sistema da clínica" };

  const target = ruleTargetDate(now, rule.daysAfter);
  const { patients, futurePhones } = await fetchBridgeCampaignPatients(rule.clinicId, { desde: target });
  const optedOutPhones = new Set(
    (await prisma.contact.findMany({ where: { optedOutOfBroadcastsAt: { not: null }, phone: { not: null } }, select: { phone: true } }))
      .map((c) => c.phone)
      .filter((p): p is string => !!p),
  );
  const { recipients: audience } = buildCampaignAudience(patients, {
    minAge: 18,
    optedOutPhones,
    excludedPatientIds: new Set(rule.clinic.campaignExcludedPatientIds),
    today: now,
    lastVisitOn: { date: target, futurePhones: rule.requireNoFuture ? new Set(futurePhones) : undefined },
  });

  const since = new Date(now.getTime() - REPEAT_GUARD_DAYS * 86400000);
  const recent = new Set(
    (await prisma.broadcastRecipient.findMany({
      where: { phone: { in: audience.map((r) => r.phone) }, campaign: { automationRuleId: rule.id, createdAt: { gte: since } } },
      select: { phone: true },
    })).map((r) => r.phone),
  );
  const recipients = audience.filter((r) => !recent.has(r.phone));
  if (recipients.length === 0) return { ...base, status: "ninguém hoje", recipients: 0 };

  const owner = await prisma.user.findFirst({
    where: { clinicId: rule.clinicId },
    orderBy: [{ isManager: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (!owner) return { ...base, status: "clínica sem usuário" };

  await prisma.broadcastCampaign.create({
    data: {
      clinicId: rule.clinicId,
      name: ruleCampaignName(rule.name, now),
      messageTemplate: rule.cloudTemplateBody ?? rule.messageTemplate,
      cloudTemplateName: rule.cloudTemplateName,
      cloudTemplateLanguage: rule.cloudTemplateLanguage,
      cloudTemplateBody: rule.cloudTemplateBody,
      cloudTemplateParams: rule.cloudTemplateParams,
      status: "RUNNING",
      lowPriority: true,
      automationRuleId: rule.id,
      createdByUserId: owner.id,
      recipients: { create: recipients.map((r) => ({ phone: r.phone, variables: r.variables, status: "PENDING" })) },
    },
  });
  return { ...base, status: "criada", recipients: recipients.length };
}

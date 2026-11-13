import { prisma } from "@/lib/prisma";
import { DEMO_CLINIC_CNPJ } from "@/lib/demo-clinic";
import { technicalDirectorLine } from "@/lib/broadcast-csv";
import { SERVICE_NOTICE_MARK } from "@/lib/campaign-kind";
import { displayName, isUsableContactName } from "@/lib/contact-display";
import {
  LOST_REASON,
  brtDayStart,
  idlePostponedDue,
  lostNote,
  stepsOf,
  tagVariants,
  type StoredStep,
  triggerWhere,
  messageSkipReason,
  planEnrollments,
  reminderNote,
  tagAutomationCampaignName,
} from "@/lib/tag-automations";

/** Teto por automação e por rodada: uma tag aplicada em massa não vira um disparo gigante de
 * uma vez (o resto entra nas rodadas seguintes, de 10 em 10 minutos). */
const MAX_DUE_PER_RUN = 200;

type RunResult = { automationId: string; clinicId: string; name: string; status: string; count?: number };
type Automation = Awaited<ReturnType<typeof prisma.tagAutomation.findMany>>[number];

async function logRun(r: RunResult) {
  await prisma.webhookLog
    .create({ data: { event: "tag_automation.run", payload: r, status: /campanha|lembretes|finalizadas/.test(r.status) ? "SUCCESS" : "SKIPPED" } })
    .catch(() => {});
}

/** Roda a cada 10 min (cron). Para cada automação ligada: põe na fila quem acabou de receber a
 * tag, tira quem perdeu a tag, e executa quem já venceu a espera. O envio em si continua sendo
 * o do dispatcher de Disparos (ritmo, janela, consentimento de marketing, opt-out). */
export async function runTagAutomations(now = new Date()): Promise<RunResult[]> {
  const automations = await prisma.tagAutomation.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (automations.length === 0) return [];
  const clinics = await prisma.clinic.findMany({
    where: { id: { in: [...new Set(automations.map((a) => a.clinicId))] } },
    select: { id: true, cnpj: true, technicalDirectorName: true, technicalDirectorCrm: true },
  });
  const results: RunResult[] = [];
  for (const automation of automations) {
    const clinic = clinics.find((c) => c.id === automation.clinicId);
    // Clínica demo: a automação liga na tela, mas nunca roda (mesma regra da régua).
    if (!clinic || clinic.cnpj === DEMO_CLINIC_CNPJ) continue;
    const base = { automationId: automation.id, clinicId: automation.clinicId, name: automation.name };
    const result = await runOne(automation, clinic, now).catch((e: unknown) => ({ ...base, status: `erro: ${e instanceof Error ? e.message.split("\n")[0] : "desconhecido"}` }));
    if (result.status !== "nada vencido") await logRun(result);
    results.push(result);
  }
  return results;
}

type Trigger = { id: string; clinicId: string; triggerKind: string; tag: string; stage: string | null };

/** Filtro do gatilho. Por tag, busca antes as grafias que existem na clínica ("Teste", "teste"),
 * porque o Postgres compara o texto da tag exatamente. */
async function triggerFilter(a: Trigger) {
  if (a.triggerKind !== "TAG") return triggerWhere(a);
  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT unnest(tags) AS tag FROM conversations WHERE clinic_id = ${a.clinicId} AND cardinality(tags) > 0`;
  return triggerWhere(a, tagVariants(a.tag, rows.map((r) => r.tag)));
}

/** Sincroniza a fila da automação com as conversas que estão no gatilho (tag ou etapa) agora. */
export async function syncEnrollments(automation: Trigger & { delayHours: number }, now: Date) {
  const [tagged, existing] = await Promise.all([
    prisma.conversation.findMany({ where: await triggerFilter(automation), select: { id: true } }),
    prisma.tagAutomationEnrollment.findMany({ where: { automationId: automation.id }, select: { id: true, conversationId: true, status: true } }),
  ]);
  const plan = planEnrollments({ delayHours: automation.delayHours, taggedConversationIds: tagged.map((c) => c.id), existing, now });
  if (plan.removeIds.length) await prisma.tagAutomationEnrollment.deleteMany({ where: { id: { in: plan.removeIds } } });
  if (plan.create.length) {
    await prisma.tagAutomationEnrollment.createMany({
      data: plan.create.map((c) => ({ automationId: automation.id, conversationId: c.conversationId, dueAt: c.dueAt, status: "PENDING" })),
      skipDuplicates: true,
    });
  }
  return plan;
}

/** Ao ligar (ou trocar a tag de) uma automação: quem já tem a tag entra como BASELINE e não
 * recebe nada. Só quem receber a tag daqui para a frente dispara. */
export async function resetBaseline(automation: Trigger, now: Date) {
  await prisma.tagAutomationEnrollment.deleteMany({ where: { automationId: automation.id } });
  const tagged = await prisma.conversation.findMany({ where: await triggerFilter(automation), select: { id: true } });
  if (tagged.length) {
    await prisma.tagAutomationEnrollment.createMany({
      data: tagged.map((c) => ({ automationId: automation.id, conversationId: c.id, dueAt: now, status: "BASELINE", doneAt: now })),
      skipDuplicates: true,
    });
  }
  return tagged.length;
}

type Entry = Awaited<ReturnType<typeof prisma.tagAutomationEnrollment.findMany>>[number];
type Conv = { id: string; status: string; tags: string[]; lastMessageAt: Date | null; assignedUserId: string | null; contact: { phone: string | null; name: string } };
type StepResult = { status: string; count?: number };

async function runOne(
  automation: Automation,
  clinic: { technicalDirectorName: string | null; technicalDirectorCrm: string | null },
  now: Date,
): Promise<RunResult> {
  const base = { automationId: automation.id, clinicId: automation.clinicId, name: automation.name };
  await syncEnrollments(automation, now);

  const allDue = await prisma.tagAutomationEnrollment.findMany({
    where: { automationId: automation.id, status: "PENDING", dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: MAX_DUE_PER_RUN,
  });
  if (allDue.length === 0) return { ...base, status: "nada vencido" };

  const steps = stepsOf(automation);
  // clinicId de novo no filtro: a entrada guarda só o id da conversa, e ela tem que ser desta clínica.
  const conversations = await prisma.conversation.findMany({
    where: { id: { in: allDue.map((d) => d.conversationId) }, clinicId: automation.clinicId },
    select: { id: true, status: true, tags: true, lastMessageAt: true, assignedUserId: true, contact: { select: { phone: true, name: true } } },
  });
  const byId = new Map<string, Conv>(conversations.map((c) => [c.id, c]));

  // Parar na resposta: paciente escreveu depois de entrar na automação → sai da fila (em qualquer passo).
  const replied = new Set<string>();
  if (automation.stopOnReply) {
    const enteredAt = new Map(allDue.map((d) => [d.conversationId, d.createdAt]));
    const inbound = await prisma.message.findMany({
      where: { conversationId: { in: allDue.map((d) => d.conversationId) }, direction: "INBOUND", type: { not: "INTERNAL_NOTE" } },
      orderBy: { createdAt: "desc" },
      distinct: ["conversationId"],
      select: { conversationId: true, createdAt: true },
    });
    for (const m of inbound) {
      const entered = enteredAt.get(m.conversationId);
      if (!entered || m.createdAt > entered) replied.add(m.conversationId);
    }
  }

  const dueByStep = new Map<number, Entry[]>();
  for (const entry of allDue) {
    const index = entry.stepIndex ?? 0;
    const step = steps[index];
    if (replied.has(entry.conversationId)) {
      await prisma.tagAutomationEnrollment.update({ where: { id: entry.id }, data: { status: "SKIPPED", doneAt: now, note: "paciente respondeu" } });
      continue;
    }
    // A sequência encolheu depois que a conversa entrou: não há mais passo para ela.
    if (!step) {
      await prisma.tagAutomationEnrollment.update({ where: { id: entry.id }, data: { status: "DONE", doneAt: now } });
      continue;
    }
    // Tempo parado: mensagem recente na conversa adia o vencimento em vez de disparar.
    if (automation.waitFrom === "LAST_MESSAGE") {
      const postponed = idlePostponedDue({ lastMessageAt: byId.get(entry.conversationId)?.lastMessageAt ?? null, delayHours: step.delayHours, now });
      if (postponed) {
        await prisma.tagAutomationEnrollment.update({ where: { id: entry.id }, data: { dueAt: postponed } });
        continue;
      }
    }
    dueByStep.set(index, [...(dueByStep.get(index) ?? []), entry]);
  }
  if (dueByStep.size === 0) return { ...base, status: "nada vencido" };

  const results: StepResult[] = [];
  for (const [index, entries] of [...dueByStep.entries()].sort((a, b) => a[0] - b[0])) {
    const ctx: StepContext = { automation, clinic, now, byId, step: steps[index], stepNumber: steps.length > 1 ? index + 1 : undefined, next: steps[index + 1] ?? null, nextIndex: index + 1 };
    const step = steps[index];
    results.push(step.action === "REMINDER" ? await runReminderStep(ctx, entries) : step.action === "LOST" ? await runLostStep(ctx, entries) : await runMessageStep(ctx, entries));
  }
  if (results.length === 1) return { ...base, ...results[0] };
  return { ...base, status: results.map((r) => r.status).join(" + "), count: results.reduce((sum, r) => sum + (r.count ?? 0), 0) };
}

type StepContext = {
  automation: Automation;
  clinic: { technicalDirectorName: string | null; technicalDirectorCrm: string | null };
  now: Date;
  byId: Map<string, Conv>;
  step: StoredStep;
  /** 1, 2, 3… quando a automação tem mais de um passo (vai no nome da campanha). */
  stepNumber: number | undefined;
  next: StoredStep | null;
  nextIndex: number;
};

/** O que gravar na entrada depois de executar o passo: terminou, ou espera o próximo. */
function afterStep(ctx: StepContext, extra: Record<string, unknown> = {}) {
  return ctx.next
    ? { status: "PENDING", stepIndex: ctx.nextIndex, dueAt: new Date(ctx.now.getTime() + ctx.next.delayHours * 3_600_000), doneAt: ctx.now, ...extra }
    : { status: "DONE", doneAt: ctx.now, ...extra };
}

async function runReminderStep(ctx: StepContext, due: Entry[]): Promise<StepResult> {
  let count = 0;
  for (const entry of due) {
    const conv = ctx.byId.get(entry.conversationId);
    if (!conv) continue;
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: "OUTBOUND",
        type: "INTERNAL_NOTE",
        content: reminderNote(ctx.automation.name, ctx.step.reminderText),
        status: "SENT",
      },
    });
    // Vai para a lista de tarefas (/clinic/tarefas): vence hoje, com quem atende a conversa.
    await prisma.receptionTask.create({
      data: {
        clinicId: ctx.automation.clinicId,
        conversationId: conv.id,
        text: ctx.step.reminderText.trim(),
        dueAt: ctx.now,
        assignedUserId: conv.assignedUserId ?? null,
        source: ctx.automation.name,
      },
    });
    await prisma.tagAutomationEnrollment.update({ where: { id: entry.id }, data: afterStep(ctx) });
    count++;
  }
  return { status: "lembretes", count };
}

/** Último passo: finaliza a conversa como "paciente não respondeu". Não manda despedida. */
async function runLostStep(ctx: StepContext, due: Entry[]): Promise<StepResult> {
  let count = 0;
  for (const entry of due) {
    const conv = ctx.byId.get(entry.conversationId);
    if (conv && conv.status !== "RESOLVED") {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { status: "RESOLVED", resolutionReason: LOST_REASON, resolutionNotes: `Automação: ${ctx.automation.name}`, resolvedAt: ctx.now },
      });
      await prisma.message.create({
        data: { conversationId: conv.id, direction: "OUTBOUND", type: "INTERNAL_NOTE", content: lostNote(ctx.automation.name), status: "SENT" },
      });
      count++;
    }
    await prisma.tagAutomationEnrollment.update({ where: { id: entry.id }, data: { status: "DONE", doneAt: ctx.now } });
  }
  return { status: "finalizadas", count };
}

async function runMessageStep(ctx: StepContext, due: Entry[]): Promise<StepResult> {
  const { automation, clinic, now, step } = ctx;
  // Mensagem: só com a API oficial e modelo aprovado. Sem isso a fila fica esperando.
  const cloud = await prisma.whatsappCloudAccount.findUnique({ where: { clinicId: automation.clinicId }, select: { active: true } });
  if (!cloud?.active) return { status: "sem API oficial ativa" };
  if (!step.cloudTemplateName) return { status: "sem modelo aprovado" };
  // Aviso de serviço não é propaganda: não exige responsável técnico (regra do CFM é de publicidade).
  if (automation.mode === "AUTO" && !automation.serviceNotice && !technicalDirectorLine(clinic.technicalDirectorName, clinic.technicalDirectorCrm)) {
    return { status: "sem responsável técnico" };
  }

  const recipients: { entryId: string; phone: string; variables: Record<string, string> }[] = [];
  const seenPhones = new Set<string>();
  for (const entry of due) {
    const conv = ctx.byId.get(entry.conversationId);
    if (!conv) continue;
    const skip = messageSkipReason({ phone: conv.contact.phone, tags: conv.tags }, automation.tag);
    const phone = conv.contact.phone;
    if (skip || !phone) {
      await prisma.tagAutomationEnrollment.update({ where: { id: entry.id }, data: { status: "SKIPPED", doneAt: now, note: skip ?? "sem telefone" } });
      continue;
    }
    if (seenPhones.has(phone)) {
      await prisma.tagAutomationEnrollment.update({ where: { id: entry.id }, data: { status: "SKIPPED", doneAt: now, note: "telefone repetido" } });
      continue;
    }
    seenPhones.add(phone);
    const usable = isUsableContactName(conv.contact.name);
    const first = usable ? displayName(conv.contact).split(/\s+/)[0] : "";
    recipients.push({ entryId: entry.id, phone, variables: { nome: first, saudacao: usable ? `Oi, ${first}` : "Oi" } });
  }
  if (recipients.length === 0) return { status: "ninguém para enviar", count: 0 };

  // Uma campanha por automação, por passo e por dia: quem vence mais tarde no mesmo dia entra
  // na mesma, enquanto ela ainda for rascunho (REVIEW) ou estiver enviando (AUTO).
  const wantedStatus = automation.mode === "AUTO" ? "RUNNING" : "DRAFT";
  const campaignName = tagAutomationCampaignName(automation.name, now, ctx.stepNumber);
  const today = await prisma.tagAutomationEnrollment.findMany({
    where: { automationId: automation.id, campaignId: { not: null }, doneAt: { gte: brtDayStart(now) } },
    distinct: ["campaignId"],
    select: { campaignId: true },
  });
  const candidateIds = today.map((t) => t.campaignId).filter((id): id is string => !!id);
  let campaign = candidateIds.length
    ? await prisma.broadcastCampaign.findFirst({
        where: { id: { in: candidateIds }, clinicId: automation.clinicId, status: wantedStatus, name: campaignName },
        select: { id: true },
      })
    : null;

  let toSend = recipients;
  if (campaign) {
    const already = new Set(
      (await prisma.broadcastRecipient.findMany({ where: { campaignId: campaign.id, phone: { in: recipients.map((r) => r.phone) } }, select: { phone: true } })).map((r) => r.phone),
    );
    toSend = recipients.filter((r) => !already.has(r.phone));
    if (toSend.length) {
      await prisma.broadcastRecipient.createMany({
        data: toSend.map((r) => ({ campaignId: campaign!.id, phone: r.phone, variables: r.variables, status: "PENDING" as const })),
      });
    }
  } else {
    const owner = await prisma.user.findFirst({
      where: { clinicId: automation.clinicId },
      orderBy: [{ isManager: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!owner) return { status: "clínica sem usuário" };
    campaign = await prisma.broadcastCampaign.create({
      data: {
        clinicId: automation.clinicId,
        name: campaignName,
        messageTemplate: step.cloudTemplateBody ?? "",
        cloudTemplateName: step.cloudTemplateName,
        cloudTemplateLanguage: step.cloudTemplateLanguage,
        cloudTemplateBody: step.cloudTemplateBody,
        cloudTemplateParams: step.cloudTemplateParams,
        status: wantedStatus,
        // Marca interna lida pelo envio: dispensa o aceite de marketing (campaign-kind.ts).
        tagOnSend: automation.serviceNotice ? SERVICE_NOTICE_MARK : null,
        lowPriority: true,
        createdByUserId: owner.id,
        recipients: { create: recipients.map((r) => ({ phone: r.phone, variables: r.variables, status: "PENDING" as const })) },
      },
      select: { id: true },
    });
  }

  await prisma.tagAutomationEnrollment.updateMany({
    where: { id: { in: recipients.map((r) => r.entryId) } },
    data: afterStep(ctx, { campaignId: campaign.id }),
  });
  return { status: "campanha", count: toSend.length };
}

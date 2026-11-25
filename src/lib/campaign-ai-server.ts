import { errorSummary } from "@/lib/safe-error";
import "server-only";
import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { aiChat, isAiConfigured } from "@/lib/ai-gateway";
import { privacyForConversation } from "@/lib/ai-privacy-context";
import { buildClinicKnowledgeContext } from "@/lib/clinic-knowledge";
import { enforceClinicalGuard } from "@/lib/clinical-claim-guard";
import { sendWhatsAppMessage, toggleNinthDigit } from "@/lib/whatsapp";
import { recordAudit } from "@/lib/audit-server";
import { logAiAction } from "@/lib/ai-action-log-server";
import { parseCloudTemplateVariants } from "@/lib/broadcast-cloud-template";
import { buildCampaignAiPrompt, campaignAiDecision, CAMPAIGN_AI_TAG, CAMPAIGN_AI_WINDOW_DAYS } from "@/lib/campaign-ai";

const REPLY_ACTION = "campaign_ai.reply";
const HANDOFF_ACTION = "campaign_ai.handoff";

/** Lara da campanha (ver campaign-ai.ts). Chamado pelo webhook quando o atendente de IA da
 * clínica não está ativo. Retorna true se a Lara respondeu (a mensagem não segue para as
 * automações por palavra-chave). Nunca lança: qualquer falha deixa com a recepção. */
export async function replyCampaignAi(input: {
  conversationId: string;
  clinicId: string;
  phone: string;
  text: string;
  aiAttendantActive: boolean;
  conversationAiEnabled: boolean;
}): Promise<boolean> {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - CAMPAIGN_AI_WINDOW_DAYS * 86_400_000);
    const phones = [input.phone, toggleNinthDigit(input.phone)].filter((p): p is string => !!p);
    const recipient = await prisma.broadcastRecipient.findFirst({
      where: {
        phone: { in: phones },
        status: "SENT",
        sentAt: { gte: since },
        campaign: { clinicId: input.clinicId, aiFollowUp: true, channel: "WHATSAPP" },
      },
      orderBy: { sentAt: "desc" },
      select: {
        sentAt: true,
        variantIndex: true,
        campaign: { select: { id: true, name: true, messageTemplate: true, cloudTemplateBody: true, cloudTemplateVariants: true } },
      },
    });
    if (!recipient?.sentAt) return false;
    const sentAt = recipient.sentAt;

    const [humanReply, audits] = await Promise.all([
      prisma.message.findFirst({
        where: { conversationId: input.conversationId, direction: "OUTBOUND", senderUserId: { not: null }, createdAt: { gte: sentAt } },
        select: { id: true },
      }),
      prisma.auditLog.findMany({
        where: { action: { in: [REPLY_ACTION, HANDOFF_ACTION] }, entity: "Conversation", entityId: input.conversationId, createdAt: { gte: sentAt } },
        select: { action: true },
      }),
    ]);

    const decision = campaignAiDecision({
      now,
      campaignSentAt: sentAt,
      aiAttendantActive: input.aiAttendantActive,
      conversationAiEnabled: input.conversationAiEnabled,
      humanRepliedSinceCampaign: !!humanReply,
      repliesSoFar: audits.filter((a) => a.action === REPLY_ACTION).length,
      handedOff: audits.some((a) => a.action === HANDOFF_ACTION),
      text: input.text,
    });
    if (decision === "SKIP") return false;
    if (decision === "HANDOFF") {
      await handOff(input.conversationId, input.clinicId, recipient.campaign.name, "parou: pedido de atendente, urgência, mensagem sem texto ou limite de respostas");
      return false;
    }

    const campaignText = campaignMessageText(recipient.campaign, recipient.variantIndex);
    const text = await generate(input.conversationId, input.clinicId, sentAt, campaignText);
    if (!text) {
      await handOff(input.conversationId, input.clinicId, recipient.campaign.name, "IA sem resposta (falha ou trava clínica)");
      return false;
    }

    const result = await sendWhatsAppMessage(input.phone, text, REPLY_ACTION, input.clinicId);
    await prisma.message.create({
      data: { conversationId: input.conversationId, direction: "OUTBOUND", content: text, status: result.success ? "DELIVERED" : "FAILED" },
    });
    await addTag(input.conversationId);
    await recordAudit({
      clinicId: input.clinicId,
      userId: null,
      action: REPLY_ACTION,
      entity: "Conversation",
      entityId: input.conversationId,
      before: null,
      after: { campaignId: recipient.campaign.id },
    });
    await logAiAction({ clinicId: input.clinicId, conversationId: input.conversationId, kind: "AI_REPLIED", summary: `Lara (campanha “${recipient.campaign.name}”): ${input.text}` });
    return true;
  } catch (error) {
    console.error("[Lara da campanha] falha:", errorSummary(error));
    return false;
  }
}

function campaignMessageText(
  campaign: { messageTemplate: string; cloudTemplateBody: string | null; cloudTemplateVariants: unknown },
  variantIndex: number | null,
): string {
  if (campaign.cloudTemplateBody) {
    if (variantIndex && variantIndex > 0) {
      const v = parseCloudTemplateVariants(campaign.cloudTemplateVariants)[variantIndex - 1];
      if (v?.body) return v.body;
    }
    return campaign.cloudTemplateBody;
  }
  return campaign.messageTemplate;
}

async function generate(conversationId: string, clinicId: string, sentAt: Date, campaignText: string): Promise<string | null> {
  if (!isAiConfigured()) return null;
  const [privacyBase, knowledge, clinic, config, recent] = await Promise.all([
    privacyForConversation(conversationId),
    buildClinicKnowledgeContext(clinicId),
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { tradeName: true } }),
    prisma.aiAttendantConfig.findUnique({ where: { clinicId }, select: { assistantName: true } }),
    prisma.message.findMany({
      where: { conversationId, type: { not: "INTERNAL_NOTE" }, deletedAt: null, createdAt: { gte: sentAt } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { direction: true, content: true },
    }),
  ]);
  const privacy = { ...privacyBase, clinicId, feature: "atendente" as const };
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildCampaignAiPrompt({ assistantName: config?.assistantName ?? null, clinicName: clinic?.tradeName ?? "nossa clínica", knowledge }) },
    { role: "assistant", content: campaignText },
    ...recent.reverse().map((m) => ({ role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant", content: m.content })),
  ];
  const ask = async (extra?: string) => {
    const res = await aiChat(privacy, {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: extra ? [...messages, { role: "system", content: extra }] : messages,
      max_tokens: 250,
      temperature: 0.4,
    });
    return res.choices[0]?.message?.content?.trim() || null;
  };
  try {
    const first = await ask();
    if (!first) return null;
    const guarded = await enforceClinicalGuard(first, (instruction) => ask(instruction).catch(() => null));
    return guarded.text;
  } catch (error) {
    console.error("[Lara da campanha] falha ao gerar:", errorSummary(error));
    return null;
  }
}

async function addTag(conversationId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { tags: true } });
  if (conv && !conv.tags.includes(CAMPAIGN_AI_TAG)) {
    await prisma.conversation.update({ where: { id: conversationId }, data: { tags: { push: CAMPAIGN_AI_TAG } } });
  }
}

/** Para em silêncio: nada vai para o paciente; a conversa fica marcada e segue na fila. */
async function handOff(conversationId: string, clinicId: string, campaignName: string, reason: string) {
  await addTag(conversationId);
  await recordAudit({ clinicId, userId: null, action: HANDOFF_ACTION, entity: "Conversation", entityId: conversationId, before: null, after: { reason } });
  await logAiAction({ clinicId, conversationId, kind: "AI_ESCALATED", summary: `Lara (campanha “${campaignName}”) passou para a recepção: ${reason}` });
}

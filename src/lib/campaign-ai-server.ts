import { errorSummary } from "@/lib/safe-error";
import "server-only";
import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { aiChat, isAiConfigured } from "@/lib/ai-gateway";
import { privacyForConversation } from "@/lib/ai-privacy-context";
import { sendWhatsAppMessage, toggleNinthDigit } from "@/lib/whatsapp";
import { recordAudit } from "@/lib/audit-server";
import { logAiAction } from "@/lib/ai-action-log-server";
import { parseCloudTemplateVariants } from "@/lib/broadcast-cloud-template";
import { isAutoReply, buildCampaignAiPrompt, campaignAiDecision, campaignAiReply, parseCampaignAiOutcome, CAMPAIGN_AI_TAG, CAMPAIGN_AI_WINDOW_DAYS, type CampaignAiOutcome } from "@/lib/campaign-ai";

const REPLY_ACTION = "campaign_ai.reply";
const HANDOFF_ACTION = "campaign_ai.handoff";
const CLAIM_ACTION = "campaign_ai.claim";

/** Lara da campanha (ver campaign-ai.ts). Chamado pelo webhook quando o atendente de IA da
 * clínica não está ativo. Retorna true se a Lara respondeu (a mensagem não segue para as
 * automações por palavra-chave). Nunca lança: qualquer falha deixa com a recepção. */
export async function replyCampaignAi(input: {
  conversationId: string;
  clinicId: string;
  phone: string;
  text: string;
  /** Áudio, foto ou documento: fica com a recepção. */
  hasMedia?: boolean;
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
      hasMedia: input.hasMedia,
    });
    if (decision === "SKIP") return false;
    if (decision === "HANDOFF") {
      await handOff(input.conversationId, input.clinicId, recipient.campaign.name, "parou: pedido de atendente, urgência, mensagem sem texto ou limite de respostas");
      return false;
    }

    // Duas mensagens no mesmo segundo chegam em webhooks paralelos: só a primeira responde
    // (26/11: a pergunta saiu duas vezes para uma resposta automática de empresa).
    if (!(await claimTurn(input.conversationId, input.clinicId, sentAt))) return true;

    const campaignText = campaignMessageText(recipient.campaign, recipient.variantIndex);
    const outcome: CampaignAiOutcome | null = isAutoReply(input.text)
      ? "AUTOMATICA"
      : await classify(input.conversationId, input.clinicId, sentAt, campaignText);
    if (!outcome) {
      await handOff(input.conversationId, input.clinicId, recipient.campaign.name, "IA não classificou a resposta");
      return false;
    }
    // Texto sempre fixo (CAMPAIGN_AI_TEXTS) — a IA só classifica.
    const reply = campaignAiReply(outcome, { alreadyAsked: audits.some((a) => a.action === REPLY_ACTION) });
    if (reply.text) {
      const result = await sendWhatsAppMessage(input.phone, reply.text, REPLY_ACTION, input.clinicId);
      await prisma.message.create({
        data: { conversationId: input.conversationId, direction: "OUTBOUND", content: reply.text, status: result.success ? "DELIVERED" : "FAILED" },
      });
      await addTag(input.conversationId);
      await recordAudit({
        clinicId: input.clinicId,
        userId: null,
        action: REPLY_ACTION,
        entity: "Conversation",
        entityId: input.conversationId,
        before: null,
        after: { campaignId: recipient.campaign.id, outcome },
      });
      await logAiAction({ clinicId: input.clinicId, conversationId: input.conversationId, kind: "AI_REPLIED", summary: `Lara (campanha “${recipient.campaign.name}”, ${outcome}): ${input.text}` });
    }
    if (reply.next === "HANDOFF") {
      await handOff(input.conversationId, input.clinicId, recipient.campaign.name, `${outcome} — com a recepção`);
    } else if (reply.next === "CLOSE") {
      const auto = outcome === "AUTOMATICA";
      await handOff(
        input.conversationId,
        input.clinicId,
        recipient.campaign.name,
        auto ? "resposta automática de empresa — conversa finalizada sem responder" : "paciente sem interesse — conversa finalizada",
      );
      await prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          status: "RESOLVED",
          resolutionReason: "PERDA_OUTRO",
          resolutionNotes: auto
            ? `Lara: resposta automática de empresa à campanha “${recipient.campaign.name}”`
            : `Lara: sem interesse na campanha “${recipient.campaign.name}”`,
          resolvedAt: new Date(),
        },
      });
    }
    // Sem texto (indefinido pela 2ª vez): não "consumiu" a mensagem — segue o fluxo normal.
    if (!reply.text) return false;
    return true;
  } catch (error) {
    console.error("[Lara da campanha] falha:", errorSummary(error));
    return false;
  }
}

/** Marca a vez desta mensagem e devolve true só para a primeira desde a última ação da Lara. */
async function claimTurn(conversationId: string, clinicId: string, sentAt: Date): Promise<boolean> {
  const mine = await prisma.auditLog.create({
    data: { clinicId, userId: null, action: CLAIM_ACTION, entity: "Conversation", entityId: conversationId, changes: {} },
    select: { id: true },
  });
  const lastDone = await prisma.auditLog.findFirst({
    where: { action: { in: [REPLY_ACTION, HANDOFF_ACTION] }, entity: "Conversation", entityId: conversationId, createdAt: { gte: sentAt } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const first = await prisma.auditLog.findFirst({
    where: { action: CLAIM_ACTION, entity: "Conversation", entityId: conversationId, createdAt: { gt: lastDone?.createdAt ?? sentAt } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return first?.id === mine.id;
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

/** A IA só classifica a resposta do paciente (JSON); nunca escreve para ele. */
async function classify(conversationId: string, clinicId: string, sentAt: Date, campaignText: string): Promise<CampaignAiOutcome | null> {
  if (!isAiConfigured()) return null;
  const [privacyBase, clinic, recent] = await Promise.all([
    privacyForConversation(conversationId),
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { tradeName: true } }),
    prisma.message.findMany({
      where: { conversationId, type: { not: "INTERNAL_NOTE" }, deletedAt: null, createdAt: { gte: sentAt } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { direction: true, content: true },
    }),
  ]);
  const privacy = { ...privacyBase, clinicId, feature: "atendente" as const };
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildCampaignAiPrompt({ clinicName: clinic?.tradeName ?? "nossa clínica" }) },
    { role: "assistant", content: campaignText },
    ...recent.reverse().map((m) => ({ role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant", content: m.content })),
  ];
  try {
    const res = await aiChat(privacy, {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      max_tokens: 30,
      temperature: 0,
      response_format: { type: "json_object" },
    });
    return parseCampaignAiOutcome(res.choices[0]?.message?.content);
  } catch (error) {
    console.error("[Lara da campanha] falha ao classificar:", errorSummary(error));
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

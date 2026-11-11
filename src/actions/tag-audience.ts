"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import type { ParsedBroadcastRecipient } from "@/lib/broadcast-csv";
import { buildTagAudience, countTagAudiences, type TagAudienceOption, type TaggedConversation } from "@/lib/tag-audience";

/** Conversas com alguma tag e telefone, só da clínica. Traz todas (não só as da tag pedida)
 * porque "número errado" em outra conversa do mesmo telefone também tira ele do público. */
async function taggedConversations(clinicId: string): Promise<TaggedConversation[]> {
  const rows = await prisma.conversation.findMany({
    where: { clinicId, tags: { isEmpty: false }, contact: { phone: { not: null } } },
    select: { tags: true, contact: { select: { phone: true, name: true } } },
    orderBy: { lastMessageAt: "desc" },
  });
  return rows.map((r) => ({ phone: r.contact.phone, name: r.contact.name, tags: r.tags }));
}

/** Tags da clínica que têm pelo menos um paciente com telefone, com a contagem. */
export async function listTagAudienceOptions(): Promise<TagAudienceOption[]> {
  const { clinicId } = await requireClinicPermission("disparos");
  return countTagAudiences(await taggedConversations(clinicId));
}

/** Destinatários do público "Por tag" (consentimento e opt-out são conferidos no envio). */
export async function getTagAudience(tag: string): Promise<ParsedBroadcastRecipient[]> {
  const { clinicId } = await requireClinicPermission("disparos");
  const wanted = tag.trim();
  if (!wanted || wanted.length > 100) return [];
  return buildTagAudience(await taggedConversations(clinicId), wanted);
}

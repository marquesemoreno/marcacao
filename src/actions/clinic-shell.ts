"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { displayName } from "@/lib/contact-display";
import { formatPhone } from "@/lib/format";

/** N3 — contador do item "Chat" do menu: CONVERSAS (não mensagens) minhas ou sem
 * responsável, com mensagem não lida do paciente E esperando a clínica (a última
 * mensagem é dele). Contar mensagens dava milhares — respostas pelo celular deixavam
 * as mensagens do paciente "não lidas" pra sempre no painel. */
export async function getMyUnreadCount() {
  const { clinicId, userId } = await requireClinicSession();
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM conversations c
    JOIN LATERAL (
      SELECT direction FROM messages WHERE conversation_id = c.id AND type <> 'INTERNAL_NOTE' ORDER BY created_at DESC LIMIT 1
    ) last ON true
    WHERE c.clinic_id = ${clinicId}
      AND c.status IN ('OPEN', 'PENDING') AND c.archived_at IS NULL
      AND (c.assigned_user_id = ${userId} OR c.assigned_user_id IS NULL)
      AND last.direction = 'INBOUND'
      AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.direction = 'INBOUND' AND m.read_at IS NULL)`;
  return Number(rows[0]?.n ?? 0);
}

export type GlobalSearchResult = {
  conversationId: string;
  name: string;
  subtitle: string;
  match: "paciente" | "conversa";
};

/** N3 — busca global (atalho "/"): paciente por nome/telefone/CPF e conversa pelo texto
 * das mensagens. Só da clínica da sessão. */
export async function globalSearch(query: string): Promise<GlobalSearchResult[]> {
  const { clinicId } = await requireClinicSession();
  const q = query.trim();
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, "");

  const [byPatient, byMessage] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        clinicId,
        contact: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { cpf: { contains: digits } }] : []),
            { instagramUsername: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
          ],
        },
      },
      select: { id: true, contact: { select: { name: true, phone: true, instagramUsername: true } } },
      orderBy: { lastMessageAt: "desc" },
      take: 8,
    }),
    q.length >= 3
      ? prisma.message.findMany({
          where: { conversation: { clinicId }, type: { not: "INTERNAL_NOTE" }, content: { contains: q, mode: "insensitive" } },
          select: {
            content: true,
            createdAt: true,
            conversation: { select: { id: true, contact: { select: { name: true, phone: true, instagramUsername: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],
  ]);

  const results: GlobalSearchResult[] = byPatient.map((c) => ({
    conversationId: c.id,
    name: displayName(c.contact),
    subtitle: c.contact.phone ? formatPhone(c.contact.phone) : c.contact.instagramUsername ? `@${c.contact.instagramUsername}` : "",
    match: "paciente",
  }));
  const seen = new Set(results.map((r) => r.conversationId));
  for (const m of byMessage) {
    if (seen.has(m.conversation.id)) continue;
    seen.add(m.conversation.id);
    const text = m.content.replace(/\s+/g, " ");
    const at = text.toLowerCase().indexOf(q.toLowerCase());
    const snippet = (at > 30 ? "…" : "") + text.slice(Math.max(0, at - 30), at + q.length + 50);
    results.push({ conversationId: m.conversation.id, name: displayName(m.conversation.contact), subtitle: snippet, match: "conversa" });
  }
  return results;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyInboxRealtime } from "@/lib/supabase-server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { isWithinReminderWindow } from "@/lib/automated-pacing";
import { askJevChoice } from "@/lib/jev";
import { NO_RESPONSE_TAG } from "@/lib/conversation-tags";
import {
  AUTO_CLOSE_CONCLUDED_REASON,
  AUTO_CLOSE_HOURS,
  AUTO_CLOSE_NOTICE,
  AUTO_CLOSE_REASON,
  businessHoursBetween,
  CONVERSATION_ENDING_QUESTION,
  decideAutoClose,
  endingFromJevAnswer,
  type ConversationEnding,
} from "@/lib/conversation-auto-close";

export const maxDuration = 300;

/** Avisos por clínica por rodada (de hora em hora) — nada de rajada pro número da clínica. */
const MAX_NOTICES_PER_CLINIC = 5;
/** Leituras do Jev por rodada — o acumulado antigo vai sendo fechado ao longo das horas. */
const MAX_CLASSIFICATIONS = 60;

/** Finaliza conversas paradas há mais de 4h úteis em que a última mensagem foi nossa. O Jev lê
 * o fim da conversa pra decidir se ela terminou (fecha como concluída, sem aviso) ou ficou
 * esperando o paciente (avisa e fecha como inatividade) — ver decideAutoClose. Se o
 * paciente responder depois, o webhook reabre (reopenIfResolved). De hora em hora. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const inWindow = isWithinReminderWindow(now);
  const cutoff = new Date(now.getTime() - AUTO_CLOSE_HOURS * 60 * 60 * 1000);

  const all = await prisma.conversation.findMany({
    where: { status: { in: ["OPEN", "PENDING"] }, channel: "WHATSAPP", pinned: false, lastMessageAt: { lt: cutoff } },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      clinicId: true,
      pinned: true,
      tags: true,
      lastMessageAt: true,
      contact: { select: { phone: true } },
      clinic: { select: { hospitalIntegration: { select: { remindersPausedUntil: true } } } },
      // Nota interna não conta — o que importa é a conversa com o paciente.
      messages: {
        where: { type: { not: "INTERNAL_NOTE" }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { direction: true, content: true },
      },
    },
  });
  // Paciente falou por último = está esperando a gente; nem chega a ler.
  // Só as que já passaram de 4h ÚTEIS (o filtro do banco é por horas corridas).
  const idle = new Map(all.map((c) => [c.id, c.lastMessageAt ? businessHoursBetween(c.lastMessageAt, now) : 0]));
  const candidates = all
    .filter((c) => c.messages[0]?.direction === "OUTBOUND" && (idle.get(c.id) ?? 0) >= AUTO_CLOSE_HOURS)
    .slice(0, MAX_CLASSIFICATIONS);

  const endings = new Map<string, ConversationEnding>();
  for (let i = 0; i < candidates.length; i += 10) {
    await Promise.all(
      candidates.slice(i, i + 10).map(async (c) => {
        const mensagens = [...c.messages]
          .reverse()
          .map((m) => ({ de: m.direction === "INBOUND" ? "paciente" : "clínica", texto: (m.content || "[mídia]").slice(0, 400) }));
        endings.set(c.id, endingFromJevAnswer(await askJevChoice({ mensagens }, CONVERSATION_ENDING_QUESTION)));
      })
    );
  }

  const noticesByClinic = new Map<string, number>();
  const affectedClinics = new Set<string>();
  let notified = 0;
  let concluded = 0;
  let inactive = 0;

  for (const c of candidates) {
    if (!c.lastMessageAt) continue;
    const pausedUntil = c.clinic.hospitalIntegration?.remindersPausedUntil;
    const decision = decideAutoClose({
      idleBusinessHours: idle.get(c.id) ?? 0,
      lastDirection: c.messages[0]?.direction ?? null,
      pinned: c.pinned,
      inWindow,
      paused: !!pausedUntil && pausedUntil > now,
      ending: endings.get(c.id) ?? "UNSURE",
    });
    if (decision === "skip") continue;

    if (decision === "notify_and_close") {
      const sentHere = noticesByClinic.get(c.clinicId) ?? 0;
      if (sentHere >= MAX_NOTICES_PER_CLINIC || !c.contact.phone) continue; // próxima rodada
      const result = await sendWhatsAppMessage(c.contact.phone, AUTO_CLOSE_NOTICE, "whatsapp.auto_close_notice", c.clinicId);
      if (!result.success) continue; // não fecha sem conseguir avisar — tenta na próxima rodada
      noticesByClinic.set(c.clinicId, sentHere + 1);
      await prisma.message.create({
        data: { conversationId: c.id, direction: "OUTBOUND", content: AUTO_CLOSE_NOTICE, status: "SENT", whatsappKeyId: result.keyId },
      });
      notified++;
    }

    const isConcluded = decision === "close_concluded";
    await prisma.conversation.update({
      where: { id: c.id },
      data: {
        status: "RESOLVED",
        resolutionReason: isConcluded ? AUTO_CLOSE_CONCLUDED_REASON : AUTO_CLOSE_REASON,
        resolvedAt: now,
        // Terminou bem — não é "sem retorno" do paciente.
        ...(isConcluded ? { tags: c.tags.filter((t) => t !== NO_RESPONSE_TAG) } : {}),
      },
    });
    await prisma.message.create({
      data: {
        conversationId: c.id,
        direction: "OUTBOUND",
        type: "INTERNAL_NOTE",
        content: isConcluded
          ? "🏁 Atendimento finalizado automaticamente • Motivo: ✅ Conversa já tinha terminado (sem pendência para o paciente)"
          : `🏁 Atendimento finalizado automaticamente • Motivo: ⌛ Inatividade (sem resposta do paciente há mais de ${AUTO_CLOSE_HOURS}h úteis)`,
        status: "SENT",
      },
    });
    if (isConcluded) concluded++;
    else inactive++;
    affectedClinics.add(c.clinicId);
  }

  for (const clinicId of affectedClinics) {
    notifyInboxRealtime(clinicId).catch(() => {});
  }

  return NextResponse.json({ ok: true, classified: candidates.length, concluded, inactive, notified });
}

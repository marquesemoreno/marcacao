import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyInboxRealtime } from "@/lib/supabase-server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { isWithinReminderWindow } from "@/lib/automated-pacing";
import {
  AUTO_CLOSE_HOURS,
  AUTO_CLOSE_NOTICE,
  AUTO_CLOSE_REASON,
  decideAutoClose,
} from "@/lib/conversation-auto-close";

/** Avisos por clínica por rodada (de hora em hora) — nada de rajada pro número da clínica. */
const MAX_NOTICES_PER_CLINIC = 5;

/** Finaliza conversas paradas há mais de 24h em que a última mensagem foi nossa, avisando
 * o paciente antes (ver decideAutoClose). Se ele responder depois, o webhook reabre a
 * conversa normalmente (reopenIfResolved). De hora em hora pelo Vercel Cron (vercel.json). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const inWindow = isWithinReminderWindow(now);
  const cutoff = new Date(now.getTime() - AUTO_CLOSE_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.conversation.findMany({
    where: { status: { in: ["OPEN", "PENDING"] }, channel: "WHATSAPP", lastMessageAt: { lt: cutoff } },
    select: {
      id: true,
      clinicId: true,
      pinned: true,
      lastMessageAt: true,
      contact: { select: { phone: true } },
      clinic: { select: { hospitalIntegration: { select: { remindersPausedUntil: true } } } },
      // Nota interna não conta — o que importa é quem falou por último com o paciente.
      messages: {
        where: { type: { not: "INTERNAL_NOTE" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { direction: true },
      },
    },
  });

  const noticesByClinic = new Map<string, number>();
  const affectedClinics = new Set<string>();
  let notified = 0;
  let closed = 0;

  for (const c of candidates) {
    if (!c.lastMessageAt) continue;
    const pausedUntil = c.clinic.hospitalIntegration?.remindersPausedUntil;
    let decision = decideAutoClose({
      now,
      lastMessageAt: c.lastMessageAt,
      lastDirection: c.messages[0]?.direction ?? null,
      pinned: c.pinned,
      inWindow,
      paused: !!pausedUntil && pausedUntil > now,
    });
    if (decision === "skip") continue;

    if (decision === "notify_and_close") {
      const sentHere = noticesByClinic.get(c.clinicId) ?? 0;
      if (sentHere >= MAX_NOTICES_PER_CLINIC || !c.contact.phone) continue; // próxima rodada
      const result = await sendWhatsAppMessage(c.contact.phone, AUTO_CLOSE_NOTICE, "whatsapp.auto_close_notice", c.clinicId);
      if (!result.success) continue; // não fecha sem conseguir avisar — tenta na próxima rodada
      noticesByClinic.set(c.clinicId, sentHere + 1);
      await prisma.message.create({
        data: {
          conversationId: c.id,
          direction: "OUTBOUND",
          content: AUTO_CLOSE_NOTICE,
          status: "SENT",
          whatsappKeyId: result.keyId,
        },
      });
      notified++;
      decision = "close_silent";
    }

    await prisma.conversation.update({
      where: { id: c.id },
      data: { status: "RESOLVED", resolutionReason: AUTO_CLOSE_REASON, resolvedAt: now },
    });
    await prisma.message.create({
      data: {
        conversationId: c.id,
        direction: "OUTBOUND",
        type: "INTERNAL_NOTE",
        content: `🏁 Atendimento finalizado automaticamente • Motivo: ⌛ Inatividade (sem mensagens há mais de ${AUTO_CLOSE_HOURS}h)`,
        status: "SENT",
      },
    });
    closed++;
    affectedClinics.add(c.clinicId);
  }

  for (const clinicId of affectedClinics) {
    notifyInboxRealtime(clinicId).catch(() => {});
  }

  return NextResponse.json({ ok: true, closed, notified });
}

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorSummary } from "@/lib/safe-error";
import { formatToWhatsAppNumber, sendWhatsAppMessage, toggleNinthDigit } from "@/lib/whatsapp";
import { displayName, isUsableContactName } from "@/lib/contact-display";
import { brasiliaDayStart, callOutcome, decideMissedCallRecovery, isRecoveryOpen, missedCallText, parseCallEvent, type CallStatusEvent } from "@/lib/missed-call";

/** Fonte da tarefa e do registro de envio (aparece em /clinic/tarefas). */
export const MISSED_CALL_TASK_SOURCE = "Ligação perdida";
/** Ligação mais antiga que isso sem desfecho é deixada de lado. */
const MAX_AGE_HOURS = 24;

type StoredEvent = { status: string; at: string };

/** Webhook (evento CALL da Evolution): grava ou atualiza a ligação. Nada é mandado aqui —
 * quem decide e manda é o cron (runMissedCallRecoveries), depois da espera. */
export async function recordCallEvent(clinicId: string, raw: unknown): Promise<"recorded" | "ignored"> {
  const items = Array.isArray(raw) ? raw : [raw];
  let recorded = false;
  for (const item of items) {
    const call = parseCallEvent(item);
    if (!call) continue;
    const event: StoredEvent = { status: call.status, at: call.at.toISOString() };
    const existing = await prisma.phoneCall.findUnique({ where: { clinicId_callId: { clinicId, callId: call.callId } } });
    if (existing) {
      const events = (existing.events as StoredEvent[]) ?? [];
      if (events.some((e) => e.status === event.status && e.at === event.at)) continue;
      await prisma.phoneCall.update({
        where: { id: existing.id },
        data: {
          events: [...events, event] as Prisma.InputJsonValue,
          phone: existing.phone ?? (call.phone ? formatToWhatsAppNumber(call.phone) : null),
        },
      });
    } else {
      await prisma.phoneCall
        .create({
          data: {
            clinicId,
            callId: call.callId,
            phone: call.phone ? formatToWhatsAppNumber(call.phone) : null,
            trustedNumber: true,
            isVideo: call.isVideo,
            events: [event] as Prisma.InputJsonValue,
            startedAt: call.at,
          },
        })
        // Dois avisos da mesma ligação ao mesmo tempo: o outro já criou.
        .catch(() => null);
    }
    recorded = true;
  }
  return recorded ? "recorded" : "ignored";
}

function phoneVariants(phone: string): string[] {
  const full = formatToWhatsAppNumber(phone);
  return [full, toggleNinthDigit(full)].filter((v): v is string => !!v);
}

/** Últimos 8 dígitos: compara número da equipe com ou sem DDI/9º dígito. */
function tail8(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : null;
}

/** Próxima abertura (08h de Brasília em dia útil) — prazo da tarefa criada fora do horário. */
function nextOpening(now: Date): Date {
  let probe = new Date(now.getTime());
  for (let i = 0; i < 14 * 24 && !isRecoveryOpen(probe); i++) probe = new Date(probe.getTime() + 3600_000);
  // Arredonda para a hora cheia em que abriu.
  return new Date(Math.floor(probe.getTime() / 3600_000) * 3600_000);
}

function brasiliaTime(d: Date): string {
  const local = new Date(d.getTime() - 3 * 3600_000);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

/** Cron a cada minuto: decide cada ligação pendente (regras em missed-call.ts). */
export async function runMissedCallRecoveries(now = new Date()): Promise<{ sent: number; tasks: number; skipped: number }> {
  const result = { sent: 0, tasks: 0, skipped: 0 };
  const calls = await prisma.phoneCall.findMany({
    where: { recoveryStatus: "PENDING", startedAt: { gte: new Date(now.getTime() - MAX_AGE_HOURS * 3600_000) } },
    orderBy: { startedAt: "asc" },
    take: 50,
  });
  // Ligação pendente velha demais: fecha sem fazer nada.
  await prisma.phoneCall.updateMany({
    where: { recoveryStatus: "PENDING", startedAt: { lt: new Date(now.getTime() - MAX_AGE_HOURS * 3600_000) } },
    data: { recoveryStatus: "SKIPPED", recoveryReason: "ANTIGA" },
  });

  for (const call of calls) {
    try {
      const outcome = await processCall(call, now);
      if (outcome === "SENT") result.sent++;
      else if (outcome === "TASK") result.tasks++;
      else if (outcome === "SKIPPED") result.skipped++;
    } catch (error) {
      console.error("Recuperação de ligação perdida falhou:", errorSummary(error));
    }
  }
  return result;
}

type PhoneCallRow = Awaited<ReturnType<typeof prisma.phoneCall.findMany>>[number];

async function processCall(call: PhoneCallRow, now: Date): Promise<"SENT" | "TASK" | "SKIPPED" | "WAIT"> {
  const events: CallStatusEvent[] = ((call.events as StoredEvent[]) ?? []).map((e) => ({ status: e.status, at: new Date(e.at) }));
  const outcome = callOutcome(events, now);
  if (outcome === "PENDING") return "WAIT";
  if (outcome !== "MISSED") {
    await prisma.phoneCall.update({ where: { id: call.id }, data: { outcome, recoveryStatus: "SKIPPED", recoveryReason: outcome } });
    return "SKIPPED";
  }
  const missedAt = new Date(Math.max(...events.map((e) => e.at.getTime())));

  const clinic = await prisma.clinic.findUnique({
    where: { id: call.clinicId },
    select: { id: true, tradeName: true, missedCallRecoveryEnabled: true },
  });
  if (!clinic) return "WAIT";

  const variants = call.phone ? phoneVariants(call.phone) : [];
  const conversation = variants.length
    ? await prisma.conversation.findFirst({
        where: { clinicId: clinic.id, contact: { phone: { in: variants } } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          tags: true,
          contact: { select: { name: true, phone: true } },
          messages: {
            where: { direction: "OUTBOUND", type: { not: "INTERNAL_NOTE" }, OR: [{ senderUserId: { not: null } }, { sentFromDevice: true }] },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      })
    : null;

  const phoneTail = tail8(call.phone);
  const [teamUsers, clinics, answeredLater, lastRecovery, sentLastHour, sentToday, openTask, integration] = await Promise.all([
    prisma.user.findMany({ where: { phone: { not: null }, role: { not: "PATIENT" } }, select: { phone: true } }),
    prisma.clinic.findMany({ select: { phone: true, whatsapp: true } }),
    variants.length
      ? prisma.phoneCall.findMany({
          where: { clinicId: clinic.id, phone: { in: variants }, startedAt: { gt: call.startedAt } },
          select: { events: true },
          take: 10,
        })
      : Promise.resolve([]),
    variants.length
      ? prisma.phoneCall.findFirst({
          where: { clinicId: clinic.id, phone: { in: variants }, recoveryStatus: "SENT" },
          orderBy: { recoveredAt: "desc" },
          select: { recoveredAt: true },
        })
      : Promise.resolve(null),
    prisma.phoneCall.count({ where: { clinicId: clinic.id, recoveryStatus: "SENT", recoveredAt: { gte: new Date(now.getTime() - 3600_000) } } }),
    prisma.phoneCall.count({ where: { clinicId: clinic.id, recoveryStatus: "SENT", recoveredAt: { gte: brasiliaDayStart(now) } } }),
    variants.length
      ? prisma.receptionTask.findFirst({
          where: { clinicId: clinic.id, source: MISSED_CALL_TASK_SOURCE, doneAt: null, text: { contains: variants[0].slice(-8) } },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.hospitalIntegration.findFirst({ where: { clinicId: clinic.id }, select: { remindersPausedUntil: true } }),
  ]);
  const teamTails = new Set(
    [...teamUsers.map((u) => u.phone), ...clinics.flatMap((c) => [c.phone, c.whatsapp])].map(tail8).filter((t): t is string => !!t)
  );

  const open = isRecoveryOpen(now);
  const decision = decideMissedCallRecovery({
    now,
    missedAt,
    enabled: clinic.missedCallRecoveryEnabled,
    phone: call.phone,
    open,
    tags: conversation?.tags ?? [],
    isTeamNumber: !!phoneTail && teamTails.has(phoneTail),
    answeredLater: answeredLater.some(
      (c) => callOutcome(((c.events as StoredEvent[]) ?? []).map((e) => ({ status: e.status, at: new Date(e.at) })), now) === "ANSWERED"
    ),
    lastTeamReplyAt: conversation?.messages[0]?.createdAt ?? null,
    lastRecoveryToNumberAt: lastRecovery?.recoveredAt ?? null,
    clinicSentLastHour: sentLastHour,
    clinicSentToday: sentToday,
    openTaskForNumber: !!openTask,
    paused: !!integration?.remindersPausedUntil && integration.remindersPausedUntil > now,
  });

  if (decision.action === "WAIT") {
    if (call.outcome !== "MISSED") await prisma.phoneCall.update({ where: { id: call.id }, data: { outcome: "MISSED" } });
    return "WAIT";
  }
  if (decision.action === "SKIP") {
    await prisma.phoneCall.update({ where: { id: call.id }, data: { outcome: "MISSED", recoveryStatus: "SKIPPED", recoveryReason: decision.reason } });
    return "SKIPPED";
  }

  const who = conversation?.contact ? displayName(conversation.contact) : call.phone ?? "número desconhecido";
  const createTask = async (reason: string) => {
    if (openTask) {
      await prisma.phoneCall.update({ where: { id: call.id }, data: { outcome: "MISSED", recoveryStatus: "SKIPPED", recoveryReason: "TAREFA_ABERTA" } });
      return "SKIPPED" as const;
    }
    const task = await prisma.receptionTask.create({
      data: {
        clinicId: clinic.id,
        conversationId: conversation?.id ?? null,
        text: `📞 Retornar ligação perdida de ${who} (${call.phone}) às ${brasiliaTime(missedAt)}`,
        dueAt: open ? new Date(now.getTime() + 30 * 60_000) : nextOpening(now),
        source: MISSED_CALL_TASK_SOURCE,
      },
    });
    await prisma.phoneCall.update({
      where: { id: call.id },
      data: { outcome: "MISSED", recoveryStatus: "TASK", recoveryReason: reason, taskId: task.id, recoveredAt: now },
    });
    return "TASK" as const;
  };

  if (decision.action === "TASK") return createTask(decision.reason);

  // SEND — reserva antes de mandar: dois crons ao mesmo tempo não mandam duas vezes.
  const claimed = await prisma.phoneCall.updateMany({
    where: { id: call.id, recoveryStatus: "PENDING" },
    data: { outcome: "MISSED", recoveryStatus: "SENDING" },
  });
  if (claimed.count === 0) return "WAIT";
  const contactName = conversation?.contact?.name ?? null;
  const firstName = isUsableContactName(contactName) && conversation?.contact ? displayName(conversation.contact).split(/\s+/)[0] : null;
  const text = missedCallText({ firstName, trustedNumber: call.trustedNumber, clinicName: clinic.tradeName, open });
  const res = await sendWhatsAppMessage(call.phone!, text, "whatsapp.missed_call_recovery", clinic.id).catch(() => ({ success: false }));
  if (conversation) {
    await prisma.message.create({
      data: { conversationId: conversation.id, direction: "OUTBOUND", type: "TEXT", content: text, status: res.success ? "SENT" : "FAILED" },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } });
  }
  if (!res.success) {
    await prisma.phoneCall.update({ where: { id: call.id }, data: { recoveryStatus: "PENDING" } });
    return createTask("ENVIO_FALHOU");
  }
  await prisma.phoneCall.update({ where: { id: call.id }, data: { recoveryStatus: "SENT", recoveryReason: null, recoveredAt: now } });
  return "SENT";
}

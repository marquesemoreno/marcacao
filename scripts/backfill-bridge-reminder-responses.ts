/**
 * Corrige "Sem Retorno" das Confirmações (/clinic/relatorio): lembretes D-1 do bridge cuja
 * resposta nunca foi gravada em BridgeReminderLog —
 *   (a) lembretes de antes de 28/09/2026 não tinham `phone` (não dava pra casar a resposta);
 *   (b) paciente com Appointment antigo no painel caía em outro ramo do webhook (corrigido).
 *
 *   npx tsx --env-file=.env scripts/backfill-bridge-reminder-responses.ts --days=45           (só conta)
 *   npx tsx --env-file=.env scripts/backfill-bridge-reminder-responses.ts --days=45 --apply   (grava)
 *
 * Telefone: mensagem do lembrete no chat (gravada segundos antes do log, mesma clínica).
 * Resposta: 1ª mensagem do paciente em até 3 dias (antes do próximo lembrete) — regra fixa
 * (resolveStatusFromReply/isRescheduleReply) e, se não bater, Jev com confiança ≥ 0,85.
 * Só preenche o que está null; nunca sobrescreve resposta já gravada.
 */
import { PrismaClient } from "@prisma/client";
import { isRescheduleReply, resolveStatusFromReply, wasSentConfirmationPrompt } from "../src/lib/appointment-reply";
import { classifyReplyWithJev } from "../src/lib/jev";

const APPLY = process.argv.includes("--apply");
const DAYS = Number(process.argv.find((a) => a.startsWith("--days="))?.slice(7) ?? 45);
const prisma = new PrismaClient();
const WINDOW_MS = 3 * 86_400_000;

async function main() {
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const logs = await prisma.bridgeReminderLog.findMany({
    where: { sentAt: { gte: since, lt: new Date(Date.now() - 3_600_000) }, response: null },
    orderBy: { sentAt: "asc" },
  });
  const usedMessageIds = new Set<string>();
  const counts = { logs: logs.length, phoneFound: 0, phoneMissing: 0, CONFIRMED: 0, CANCELLED: 0, RESCHEDULE: 0, viaJev: 0, noReply: 0, unclear: 0 };
  const unclearSamples: string[] = [];

  for (const log of logs) {
    // Mensagem do lembrete no chat → conversa e telefone.
    const candidates = await prisma.message.findMany({
      where: {
        direction: "OUTBOUND",
        type: "TEXT",
        createdAt: { gte: new Date(log.sentAt.getTime() - 120_000), lte: new Date(log.sentAt.getTime() + 5_000) },
        conversation: { clinicId: log.clinicId, ...(log.phone ? { contact: { phone: { in: phoneVariants(log.phone) } } } : {}) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, content: true, createdAt: true, conversationId: true, conversation: { select: { contact: { select: { phone: true } } } } },
    });
    const reminder = candidates.find((m) => !usedMessageIds.has(m.id) && wasSentConfirmationPrompt(m.content));
    if (!reminder || !reminder.conversation.contact.phone) {
      counts.phoneMissing++;
      continue;
    }
    usedMessageIds.add(reminder.id);
    counts.phoneFound++;
    const phone = log.phone ?? reminder.conversation.contact.phone;

    // 1ª resposta do paciente em até 3 dias, antes do próximo lembrete na mesma conversa.
    const nextReminder = await prisma.message.findFirst({
      where: { conversationId: reminder.conversationId, direction: "OUTBOUND", createdAt: { gt: reminder.createdAt }, OR: [{ content: { contains: "Lembrando da sua consulta" } }, { content: { contains: "Eu sou a Lara" } }] },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const until = Math.min(log.sentAt.getTime() + WINDOW_MS, nextReminder?.createdAt.getTime() ?? Infinity);
    // Até 3 mensagens do paciente — muita gente manda "Bom dia" antes da resposta de fato.
    const replies = await prisma.message.findMany({
      where: { conversationId: reminder.conversationId, direction: "INBOUND", type: "TEXT", createdAt: { gt: reminder.createdAt, lt: new Date(until) } },
      orderBy: { createdAt: "asc" },
      take: 3,
      select: { content: true, createdAt: true },
    });

    let response: "CONFIRMED" | "CANCELLED" | "RESCHEDULE" | null = null;
    let reply = replies[0] ?? null;
    for (const r of replies) {
      const status = resolveStatusFromReply(r.content);
      if (status === "CONFIRMED" || status === "CANCELLED") response = status;
      else if (isRescheduleReply(r.content)) response = "RESCHEDULE";
      else {
        const jev = await classifyReplyWithJev(r.content, reminder.content);
        if (jev && jev !== "UNCLEAR") {
          response = jev;
          counts.viaJev++;
        }
      }
      if (response) {
        reply = r;
        break;
      }
    }
    if (!reply) counts.noReply++;
    else if (!response) {
      counts.unclear++;
      if (unclearSamples.length < 15) unclearSamples.push(reply.content.slice(0, 60).replace(/\n/g, " "));
    } else counts[response]++;

    if (APPLY) {
      await prisma.bridgeReminderLog.update({
        where: { id: log.id },
        data: { phone, ...(response && reply ? { response, respondedAt: reply.createdAt } : {}) },
      });
    }
  }

  console.log(APPLY ? "GRAVADO" : "SIMULAÇÃO (use --apply pra gravar)", counts);
  console.log("Respostas não classificadas (ficam sem retorno — recepção tratou à mão):\n" + unclearSamples.map((s) => "  · " + s).join("\n"));
}

function phoneVariants(phone: string): string[] {
  if (phone.length === 13 && phone[4] === "9") return [phone, phone.slice(0, 4) + phone.slice(5)];
  if (phone.length === 12) return [phone, phone.slice(0, 4) + "9" + phone.slice(4)];
  return [phone];
}

main().finally(() => prisma.$disconnect());

import "server-only";
import { prisma } from "@/lib/prisma";
import { formatToWhatsAppNumber, sendWhatsAppMessage, sendWhatsAppMedia } from "@/lib/whatsapp";
import { fetchBridgeDailyAgenda } from "@/lib/hospital-bridge";
import { buildBridgeReminderMessage, buildUrolaserLaraReminderMessage, nextReminderTargetDate } from "@/lib/bridge-reminder";
import { getBaseUrl } from "@/lib/format";
import { isWithinReminderWindow, shouldSendReminder } from "@/lib/automated-pacing";
import { isMarketingGapElapsed } from "@/lib/broadcast-schedule";
import { lastAutomatedSend, marketingCampaignReady } from "@/lib/automated-pacing-server";

/** Imagem da "Lara" (mascote/atendente virtual da Urolaser, ver buildUrolaserLaraReminderMessage)
 * servida como asset estático — permanente e sem custo de Storage, ao contrário de um
 * upload no bucket privado do Supabase (que exigiria gerar signed URL a cada envio). */
const UROLASER_LARA_IMAGE_PATH = "/urolaser-lara-lembrete.jpg";

// Mesmo intervalo do disparo em massa (ver src/lib/broadcast.ts) — espaça os
// envios como se fosse uma atendente mandando na mão, um por um, em vez de uma
// rajada automatizada. Reduz o risco de o número ser marcado por spam.
function randomDelayMs(): number {
  return 1500 + Math.floor(Math.random() * 1500);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** "AAAA-MM-DD" -> "DD/MM/AAAA" só com manipulação de string — nunca via
 * `Date`, pra não repetir o mesmo bug de fuso horário já corrigido no bridge
 * (ver EXTRACT em vez de Date no index.js da Urolaser). */
function formatIsoDateToBr(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Dispara o lembrete D-1 automático pra clínicas com integração hospitalar
 * ativa, puxando a agenda direto do Firebird (via bridge) — cobre também
 * agendamentos marcados direto na recepção, não só os feitos pelo WhatsApp
 * (esses últimos já tinham lembrete manual, mas incompleto: ver reminders.ts).
 * Só manda pra quem tem telefone achado no bridge. Idempotente por
 * clínica+agendamento via BridgeReminderLog — chamar de novo não duplica.
 * `clinicId` restringe a uma única clínica (ex: disparo manual adiantado só
 * pra uma, sem mexer nas outras que têm bridge ativo). `dateIso` sobrescreve
 * a data-alvo (default: amanhã, ou o próximo dia útil se a clínica tiver
 * `skipWeekendReminders` — ver nextReminderTargetDate) pra TODAS as clínicas
 * dessa chamada — usado pra disparo manual antecipado (ex: pedir a confirmação
 * de terça numa sexta, por causa de feriado na véspera), por isso ignora
 * skipWeekendReminders: é uma escolha explícita de data, não o cálculo padrão. */
export async function dispatchBridgeReminders(options?: { clinicId?: string; dateIso?: string; max?: number }) {
  const explicitDate = options?.dateIso
    ? { iso: options.dateIso, formatted: formatIsoDateToBr(options.dateIso) }
    : null;

  const clinics = await prisma.clinic.findMany({
    where: {
      hospitalIntegration: {
        active: true,
        // Pausa por clínica (ex: número restrito pela Meta) — ver remindersPausedUntil.
        OR: [{ remindersPausedUntil: null }, { remindersPausedUntil: { lt: new Date() } }],
      },
      ...(options?.clinicId ? { id: options.clinicId } : {}),
    },
    select: { id: true, tradeName: true, name: true, hospitalIntegration: { select: { skipWeekendReminders: true } } },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let attempted = 0;

  for (const clinic of clinics) {
    const { iso: dateIso, formatted: dateFormatted } =
      explicitDate ?? nextReminderTargetDate(new Date(), clinic.hospitalIntegration?.skipWeekendReminders ?? false);
    const agendamentos = await fetchBridgeDailyAgenda(clinic.id, dateIso);

    for (const item of agendamentos) {
      const already = await prisma.bridgeReminderLog.findUnique({
        where: { clinicId_bridgeNumero: { clinicId: clinic.id, bridgeNumero: item.numero } },
      });
      if (already) {
        skipped++;
        continue;
      }
      if (options?.max !== undefined && attempted >= options.max) break;

      if (attempted > 0) await sleep(randomDelayMs());
      attempted++;

      const phone = formatToWhatsAppNumber(item.telefone);
      const isUrolaser = (clinic.tradeName || clinic.name).includes("Urolaser");
      const reminderInput = {
        patientName: item.paciente || "Paciente",
        clinicName: clinic.tradeName || clinic.name,
        procedureName: item.procedimento,
        doctorName: item.medico,
        time: item.hora,
        dateFormatted,
      };
      const messageText = isUrolaser
        ? buildUrolaserLaraReminderMessage(reminderInput)
        : buildBridgeReminderMessage(reminderInput);

      // Urolaser pediu pra recriar a persona "Lara" (atendente virtual deles num
      // sistema anterior) com a imagem/mascote original — as outras clínicas com
      // bridge continuam só com texto (ver buildBridgeReminderMessage).
      const result = isUrolaser
        ? await sendWhatsAppMedia(
            phone,
            `${getBaseUrl()}${UROLASER_LARA_IMAGE_PATH}`,
            "image/jpeg",
            "lara.jpg",
            messageText,
            "appointment.bridge_reminder_d1",
            clinic.id
          )
        : await sendWhatsAppMessage(phone, messageText, "appointment.bridge_reminder_d1", clinic.id);

      // Espelha no chat independente do resultado — se falhar, a atendente já vê
      // "Falha ao enviar" no inbox e pode reenviar por lá (ver resendMessage).
      let contact = await prisma.contact.findUnique({ where: { phone } });
      if (!contact) {
        contact = await prisma.contact.create({ data: { name: item.paciente || "Paciente", phone } });
      }
      let conversation = await prisma.conversation.findFirst({ where: { clinicId: clinic.id, contactId: contact.id } });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { clinicId: clinic.id, contactId: contact.id, status: "OPEN", lastMessageAt: new Date(), tags: ["⚡ Prioritário", "✅ Agendado"] },
        });
      }
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          type: "TEXT",
          content: messageText,
          status: result.success ? "SENT" : "FAILED",
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), status: "OPEN" },
      });

      if (result.success) {
        await prisma.bridgeReminderLog.create({ data: { clinicId: clinic.id, bridgeNumero: item.numero, phone } });
        sent++;
      } else {
        failed++;
      }
    }
  }

  return { sent, skipped, failed };
}

/** Chamado a cada minuto (cron broadcast-dispatch): no máximo UM lembrete por clínica,
 * 08–18h, com 4–6 min desde a última mensagem automática da clínica e intercalando com a
 * campanha (ver automated-pacing.ts). Substitui o disparo diário em rajada das 09h. */
export async function dispatchReminderTick(): Promise<{ sent: number }> {
  const now = new Date();
  if (!isWithinReminderWindow(now)) return { sent: 0 };
  const clinics = await prisma.clinic.findMany({
    where: {
      hospitalIntegration: { active: true, OR: [{ remindersPausedUntil: null }, { remindersPausedUntil: { lt: now } }] },
    },
    select: { id: true },
  });
  let sent = 0;
  for (const clinic of clinics) {
    const last = await lastAutomatedSend(clinic.id);
    const ok = shouldSendReminder({
      inWindow: true,
      gapElapsed: isMarketingGapElapsed(last.at, now, Math.random()),
      lastKind: last.kind,
      campaignReady: last.kind === "reminder" ? await marketingCampaignReady(clinic.id, now) : false,
    });
    if (!ok) continue;
    const result = await dispatchBridgeReminders({ clinicId: clinic.id, max: 1 });
    sent += result.sent;
  }
  return { sent };
}

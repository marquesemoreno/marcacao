import "server-only";
import { prisma } from "@/lib/prisma";
import { formatToWhatsAppNumber, sendWhatsAppMessage } from "@/lib/whatsapp";
import { fetchBridgeDailyAgenda } from "@/lib/hospital-bridge";
import { buildBridgeReminderMessage } from "@/lib/bridge-reminder";

/** "Amanhã" no fuso da clínica (Bahia = mesmo horário de Brasília, sem
 * horário de verão hoje) — rodando num servidor em UTC, "amanhã" calculado
 * ingenuamente pode dar o dia errado perto da virada. */
function tomorrowInBahia(): { iso: string; formatted: string } {
  const nowInBahia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bahia" }));
  const tomorrow = new Date(nowInBahia);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const formatted = tomorrow.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return { iso, formatted };
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
 * a data-alvo (default: amanhã) — usado pra disparo manual antecipado (ex:
 * pedir a confirmação de terça numa sexta, por causa de feriado na véspera). */
export async function dispatchBridgeReminders(options?: { clinicId?: string; dateIso?: string }) {
  const { iso: dateIso, formatted: dateFormatted } = options?.dateIso
    ? { iso: options.dateIso, formatted: formatIsoDateToBr(options.dateIso) }
    : tomorrowInBahia();

  const clinics = await prisma.clinic.findMany({
    where: { hospitalIntegration: { active: true }, ...(options?.clinicId ? { id: options.clinicId } : {}) },
    select: { id: true, tradeName: true, name: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const clinic of clinics) {
    const agendamentos = await fetchBridgeDailyAgenda(clinic.id, dateIso);

    for (const item of agendamentos) {
      const already = await prisma.bridgeReminderLog.findUnique({
        where: { clinicId_bridgeNumero: { clinicId: clinic.id, bridgeNumero: item.numero } },
      });
      if (already) {
        skipped++;
        continue;
      }

      const phone = formatToWhatsAppNumber(item.telefone);
      const messageText = buildBridgeReminderMessage({
        patientName: item.paciente || "Paciente",
        clinicName: clinic.tradeName || clinic.name,
        procedureName: item.procedimento,
        doctorName: item.medico,
        time: item.hora,
        dateFormatted,
      });

      const result = await sendWhatsAppMessage(phone, messageText, "appointment.bridge_reminder_d1", clinic.id);

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
        await prisma.bridgeReminderLog.create({ data: { clinicId: clinic.id, bridgeNumero: item.numero } });
        sent++;
      } else {
        failed++;
      }
    }
  }

  return { sent, skipped, failed };
}

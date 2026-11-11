import { errorSummary } from "@/lib/safe-error";
import "server-only";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, formatToWhatsAppNumber, toggleNinthDigit } from "@/lib/whatsapp";
import { notifyAgenda } from "@/lib/realtime-server";
import { recordAudit } from "@/lib/audit-server";
import { loadAgenda } from "@/lib/agenda-server";
import { addDays } from "@/lib/agenda";
import { todayInBahia } from "@/lib/agenda-ui";
import { buildAutoSlotOfferMessage, canAutoOffer, parseOfferReply, rankWaitlistCandidates, type OpenSlot } from "@/lib/waitlist";

/** Minutos que a vaga fica guardada pra cada candidato antes de passar pro próximo. */
export const OFFER_MINUTES = 30;

type Offer = NonNullable<Awaited<ReturnType<typeof prisma.slotOffer.findUnique>>>;

/** Vaga aberta (cancelou/faltou): cria a oferta e manda pro 1º candidato. Só se a clínica
 * ligou "oferecer sozinho". Nunca derruba quem chamou. */
export async function startSlotOffer(clinicId: string, slotKey: string, slot: OpenSlot & { exceptPhone?: string | null }) {
  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { autoWaitlistOffer: true } });
    if (!clinic?.autoWaitlistOffer || !slot.time) return;
    if (canAutoOffer(slot) === "TOO_LATE") return;
    const existing = await prisma.slotOffer.findUnique({ where: { clinicId_slotKey: { clinicId, slotKey } } });
    if (existing) return; // a mesma vaga já foi oferecida (ex.: desfez e cancelou de novo)
    const offer = await prisma.slotOffer.create({
      data: { clinicId, slotKey, date: slot.date, time: slot.time, doctor: slot.doctor, procedure: slot.procedure, triedEntryIds: [] },
    });
    await advanceOffer(offer, slot.exceptPhone ?? null);
  } catch (e) {
    console.error("[vaga] falha ao iniciar oferta", errorSummary(e));
  }
}

/** Manda a oferta pro próximo candidato que ainda não recebeu (ou encerra sem candidatos). */
async function advanceOffer(offer: Offer, exceptPhone: string | null = null) {
  const when = canAutoOffer(offer);
  if (when === "TOO_LATE") {
    await prisma.slotOffer.update({ where: { id: offer.id }, data: { status: "EXPIRED", entryId: null, phone: null, expiresAt: null } });
    return;
  }
  if (when === "WAIT") {
    // Fora do horário: o cron manda às 07h.
    await prisma.slotOffer.update({ where: { id: offer.id }, data: { entryId: null, phone: null, expiresAt: null } });
    return;
  }
  const [entries, clinic] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { clinicId: offer.clinicId, status: "WAITING", id: { notIn: offer.triedEntryIds } },
      select: { id: true, patientName: true, phone: true, doctorName: true, period: true, status: true, createdAt: true },
    }),
    prisma.clinic.findUnique({ where: { id: offer.clinicId }, select: { tradeName: true } }),
  ]);
  const slot: OpenSlot = { date: offer.date, time: offer.time, doctor: offer.doctor, procedure: offer.procedure };
  const next = rankWaitlistCandidates(entries, slot, { exceptPhone })[0];
  if (!next) {
    await prisma.slotOffer.update({ where: { id: offer.id }, data: { status: "EXPIRED", entryId: null, phone: null, expiresAt: null } });
    await notifyAgenda(offer.clinicId);
    return;
  }
  // Reserva o candidato antes de mandar (dois crons/cliques ao mesmo tempo não mandam duas vezes).
  const claimed = await prisma.slotOffer.updateMany({
    where: { id: offer.id, status: "OPEN", updatedAt: offer.updatedAt },
    data: {
      entryId: next.id,
      phone: formatToWhatsAppNumber(next.phone),
      offeredAt: new Date(),
      expiresAt: new Date(Date.now() + OFFER_MINUTES * 60_000),
      triedEntryIds: { push: next.id },
    },
  });
  if (claimed.count === 0) return;
  await prisma.waitlistEntry.update({ where: { id: next.id }, data: { status: "OFFERED", offeredAt: new Date() } });
  const text = buildAutoSlotOfferMessage(slot, next.patientName, clinic?.tradeName ?? "nossa clínica", OFFER_MINUTES);
  const res = await sendWhatsAppMessage(next.phone, text, "waitlist.auto_offer", offer.clinicId).catch(() => ({ success: false }));
  await logOutbound(offer.clinicId, next.phone, text, res.success);
  if (!res.success) {
    // Não chegou: volta o candidato pra espera e tenta o próximo.
    await prisma.waitlistEntry.update({ where: { id: next.id }, data: { status: "WAITING", offeredAt: null } });
    const fresh = await prisma.slotOffer.findUnique({ where: { id: offer.id } });
    if (fresh) await advanceOffer(fresh, exceptPhone);
    return;
  }
  await notifyAgenda(offer.clinicId);
}

/** Grava a mensagem na conversa do paciente (aparece no Chat), se houver uma. */
async function logOutbound(clinicId: string, phone: string, text: string, ok: boolean) {
  const conversation = await conversationOf(clinicId, phone);
  if (!conversation) return;
  await prisma.message.create({ data: { conversationId: conversation.id, direction: "OUTBOUND", content: text, status: ok ? "DELIVERED" : "FAILED" } });
}

async function conversationOf(clinicId: string, phone: string) {
  const full = formatToWhatsAppNumber(phone);
  const variants = [full, toggleNinthDigit(full)].filter((v): v is string => !!v);
  return prisma.conversation.findFirst({ where: { clinicId, contact: { phone: { in: variants } } }, orderBy: { createdAt: "desc" }, select: { id: true } });
}

/** Webhook: resposta do paciente a uma oferta em aberto. true = tratou (não segue o fluxo). */
export async function handleSlotOfferReply(clinicId: string, phone: string, text: string, conversationId: string | null): Promise<boolean> {
  const full = formatToWhatsAppNumber(phone);
  const variants = [full, toggleNinthDigit(full)].filter((v): v is string => !!v);
  const offer = await prisma.slotOffer.findFirst({
    where: { clinicId, status: "OPEN", phone: { in: variants }, expiresAt: { gt: new Date(Date.now() - 2 * 3600_000) } },
    orderBy: { offeredAt: "desc" },
  });
  if (!offer || !offer.entryId) return false;
  const answer = parseOfferReply(text);
  if (!answer) return false; // outra coisa: fica pra recepção ler no Chat

  const slotText = `${offer.date.split("-").reverse().slice(0, 2).join("/")} às ${offer.time}${offer.doctor ? ` com ${offer.doctor}` : ""}`;
  const reply = async (msg: string) => {
    const res = await sendWhatsAppMessage(phone, msg, "waitlist.auto_offer_reply", clinicId).catch(() => ({ success: false }));
    if (conversationId) await prisma.message.create({ data: { conversationId, direction: "OUTBOUND", content: msg, status: res.success ? "DELIVERED" : "FAILED" } });
  };

  if (answer === "YES") {
    // Ainda é dele? (passou do prazo e o próximo já recebeu → a vaga não é mais dele)
    const won = await prisma.slotOffer.updateMany({ where: { id: offer.id, status: "OPEN", entryId: offer.entryId }, data: { status: "FILLED", expiresAt: null } });
    if (won.count === 0) {
      await reply("Que pena, esse horário acabou de ser preenchido. 😕 Você continua na nossa lista de espera e avisamos na próxima vaga!");
      return true;
    }
    await prisma.waitlistEntry.update({ where: { id: offer.entryId }, data: { status: "BOOKED" } });
    await reply(`Ótimo! Reservamos ${slotText} pra você. ✅ A recepção vai confirmar em instantes.`);
    if (conversationId) {
      await prisma.message.create({
        data: {
          conversationId,
          direction: "OUTBOUND",
          type: "INTERNAL_NOTE",
          content: `📅 Lista de espera: paciente ACEITOU a vaga de ${slotText}. Agende no sistema da clínica e confirme com ele.`,
          status: "SENT",
        },
      });
      await prisma.conversation.update({ where: { id: conversationId }, data: { status: "OPEN", assignedUserId: null } });
    }
    await recordAudit({ clinicId, userId: null, action: "waitlist.auto_accept", entity: "slot_offer", entityId: offer.id, before: null, after: { slot: slotText } });
    await notifyAgenda(clinicId);
    return true;
  }

  // NÃO: volta pra espera (pode querer outro horário) e oferece pro próximo.
  await prisma.waitlistEntry.update({ where: { id: offer.entryId }, data: { status: "WAITING", offeredAt: null } });
  await reply("Tudo bem! Você continua na nossa lista de espera e avisamos quando abrir outro horário. 😊");
  const fresh = await prisma.slotOffer.findUnique({ where: { id: offer.id } });
  if (fresh && fresh.entryId === offer.entryId) await advanceOffer(fresh);
  return true;
}

/** Cron: ofertas que passaram do prazo (próximo candidato) e as que esperavam as 07h. */
export async function processSlotOffers(): Promise<{ advanced: number }> {
  const due = await prisma.slotOffer.findMany({
    where: { status: "OPEN", OR: [{ expiresAt: { lt: new Date() } }, { expiresAt: null }] },
    take: 50,
  });
  for (const offer of due) {
    // Quem não respondeu volta pra espera.
    if (offer.entryId) await prisma.waitlistEntry.updateMany({ where: { id: offer.entryId, status: "OFFERED" }, data: { status: "WAITING", offeredAt: null } });
    await advanceOffer(offer);
  }
  return { advanced: due.length };
}

/** Vaga de uma marcação da Agenda (ponte ou Conecta) que virou cancelada/falta: acha
 * hora/médico na agenda do dia e oferece. */
export async function startSlotOfferForItem(clinicId: string, ref: { source: "BRIDGE" | "LOCAL"; externalId: string; date?: string | null; phone?: string | null }) {
  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { autoWaitlistOffer: true } });
    if (!clinic?.autoWaitlistOffer) return;
    const today = todayInBahia();
    const from = ref.date && ref.date >= today ? ref.date : today;
    const agenda = await loadAgenda(clinicId, from, ref.date && ref.date >= today ? ref.date : addDays(today, 3));
    const item = agenda.items.find((i) => i.source === ref.source && i.externalId === ref.externalId);
    if (!item?.time) return;
    await startSlotOffer(clinicId, `${ref.source}:${ref.externalId}`, { date: item.date, time: item.time, doctor: item.doctor, procedure: item.procedure, exceptPhone: ref.phone ?? item.phone });
  } catch (e) {
    console.error("[vaga] falha ao oferecer vaga", errorSummary(e));
  }
}

/** Ofertas em andamento/recentes (Agenda › Lista de espera). */
export async function recentSlotOffers(clinicId: string) {
  const rows = await prisma.slotOffer.findMany({
    where: { clinicId, date: { gte: todayInBahia() } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const names = await prisma.waitlistEntry.findMany({ where: { id: { in: rows.map((r) => r.entryId).filter((x): x is string => !!x) } }, select: { id: true, patientName: true } });
  const nameOf = new Map(names.map((n) => [n.id, n.patientName]));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    time: r.time,
    doctor: r.doctor,
    status: r.status as "OPEN" | "FILLED" | "EXPIRED",
    patientName: r.entryId ? nameOf.get(r.entryId) ?? null : null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    tried: r.triedEntryIds.length,
  }));
}

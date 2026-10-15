"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import {
  buildMarcadorLink,
  cleanMarcadorName,
  makeMarcadorCode,
  parseMarcadorList,
  phoneTail,
  summarizeMarcadores,
  type MarcadorRow,
} from "@/lib/marcadores";

/** Motivos de finalização que significam "agendou" (ver REASON_LABELS em inbox.ts). */
const SCHEDULED_REASONS = ["AGENDAMENTO_CONCLUIDO", "CONFIRMACAO_AGENDA", "AGENDAMENTO_REMARCADO"];

export type MarcadorWithStats = MarcadorRow & {
  phone: string;
  code: string;
  active: boolean;
  link: string | null;
  /** Conversas com o próprio marcador no período (ele marcando direto pelo WhatsApp). */
  ownConversations: number;
};

/** Marcadores da clínica + relatório do período (indicados, agendados, atendidos). */
export async function getMarcadoresReport(from: string, to: string): Promise<{ rows: MarcadorWithStats[]; clinicWhatsapp: string | null }> {
  const { clinicId } = await requireClinicSession();
  const start = new Date(`${from}T03:00:00Z`); // 00:00 na Bahia
  const end = new Date(new Date(`${to}T03:00:00Z`).getTime() + 86_400_000);

  const [clinic, marcadores] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { whatsapp: true } }),
    prisma.marcador.findMany({ where: { clinicId }, orderBy: { name: "asc" } }),
  ]);
  if (marcadores.length === 0) return { rows: [], clinicWhatsapp: clinic?.whatsapp ?? null };

  const referred = await prisma.conversation.findMany({
    where: { clinicId, marcadorId: { in: marcadores.map((m) => m.id) }, marcadorAt: { gte: start, lt: end } },
    select: {
      id: true,
      marcadorId: true,
      marcadorAt: true,
      funnelStage: true,
      resolutionReason: true,
      contact: { select: { phone: true } },
    },
  });

  // Agendou: agendamento no Conecta, lembrete da agenda da clínica (só vai pra quem está
  // marcado), etapa "Agendado" no CRM ou finalização com motivo de agendamento.
  // Atendido: marcado Presente/Atendido na Agenda ou agendamento concluído.
  const tails = [...new Set(referred.map((c) => (c.contact.phone ? phoneTail(c.contact.phone) : null)).filter((t): t is string => !!t))];
  const [appointments, reminders, marks] = tails.length
    ? await Promise.all([
        prisma.appointment.findMany({
          where: { clinicProcedure: { clinicId }, createdAt: { gte: start }, OR: tails.map((t) => ({ patientPhone: { endsWith: t } })) },
          select: { patientPhone: true, status: true, createdAt: true },
        }),
        prisma.bridgeReminderLog.findMany({
          where: { clinicId, sentAt: { gte: start }, OR: tails.map((t) => ({ phone: { endsWith: t } })) },
          select: { phone: true, sentAt: true },
        }),
        prisma.agendaMark.findMany({
          where: { clinicId, status: { in: ["IN_SERVICE", "COMPLETED"] }, OR: tails.map((t) => ({ phone: { endsWith: t } })) },
          select: { phone: true, date: true },
        }),
      ])
    : [[], [], []];

  const referrals = referred.map((c) => {
    const tail = c.contact.phone ? phoneTail(c.contact.phone) : null;
    const since = c.marcadorAt ?? start;
    const appts = tail ? appointments.filter((a) => phoneTail(a.patientPhone) === tail && a.createdAt >= since) : [];
    const reminded = tail ? reminders.some((r) => r.phone && phoneTail(r.phone) === tail && r.sentAt >= since) : false;
    const marked = tail ? marks.some((m) => m.phone && phoneTail(m.phone) === tail && m.date >= new Date(since.toISOString().slice(0, 10))) : false;
    const attended = marked || appts.some((a) => a.status === "COMPLETED");
    const scheduled =
      attended ||
      appts.length > 0 ||
      reminded ||
      c.funnelStage === "AGENDADO" ||
      (!!c.resolutionReason && SCHEDULED_REASONS.includes(c.resolutionReason));
    return { marcadorId: c.marcadorId!, scheduled, attended };
  });

  // Conversas com o próprio número do marcador (ativas no período).
  const own = await prisma.conversation.findMany({
    where: { clinicId, lastMessageAt: { gte: start, lt: end }, OR: marcadores.map((m) => ({ contact: { phone: { endsWith: phoneTail(m.phone) } } })) },
    select: { contact: { select: { phone: true } } },
  });

  const summary = summarizeMarcadores(marcadores, referrals);
  const rows: MarcadorWithStats[] = summary.map((r) => {
    const m = marcadores.find((x) => x.id === r.id)!;
    return {
      ...r,
      phone: m.phone,
      code: m.code,
      active: m.active,
      link: clinic?.whatsapp ? buildMarcadorLink(clinic.whatsapp, m) : null,
      ownConversations: own.filter((o) => o.contact.phone && phoneTail(o.contact.phone) === phoneTail(m.phone)).length,
    };
  });
  return { rows, clinicWhatsapp: clinic?.whatsapp ?? null };
}

/** Cadastra marcadores a partir de uma lista colada ("Nome – telefone" por linha). Pula
 * telefones já cadastrados. */
export async function importMarcadores(text: string): Promise<{ created: number; skipped: number }> {
  const { clinicId } = await requireClinicSession();
  const parsed = parseMarcadorList(text);
  const existing = await prisma.marcador.findMany({ where: { clinicId }, select: { code: true, phone: true } });
  const codes = new Set(existing.map((m) => m.code));
  const tails = new Set(existing.map((m) => phoneTail(m.phone)));
  const data: { clinicId: string; name: string; phone: string; code: string }[] = [];
  for (const p of parsed) {
    if (tails.has(phoneTail(p.phone))) continue;
    tails.add(phoneTail(p.phone));
    const code = makeMarcadorCode(p.name, codes);
    codes.add(code);
    data.push({ clinicId, name: p.name, phone: p.phone, code });
  }
  if (data.length) await prisma.marcador.createMany({ data });
  revalidatePath("/clinic/marcadores");
  return { created: data.length, skipped: parsed.length - data.length };
}

export async function updateMarcador(id: string, input: { name?: string; phone?: string; active?: boolean }) {
  const { clinicId } = await requireClinicSession();
  const m = await prisma.marcador.findFirst({ where: { id, clinicId } });
  if (!m) throw new Error("Marcador não encontrado.");
  const phone = input.phone?.replace(/\D/g, "");
  if (phone !== undefined && (phone.length < 10 || phone.length > 13)) throw new Error("Telefone inválido.");
  await prisma.marcador.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: cleanMarcadorName(input.name) || m.name } : {}),
      ...(phone ? { phone: phone.length <= 11 ? `55${phone}` : phone } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
  revalidatePath("/clinic/marcadores");
  return { success: true as const };
}

/** Público "Marcadores" pro Disparos: marcadores ativos, com {{nome}} e {{link}} (link
 * pessoal com o código — quem o marcador mandar entra no relatório dele). */
export async function listMarcadoresAudience(): Promise<{ phone: string; variables: Record<string, string> }[]> {
  const { clinicId } = await requireClinicSession();
  const [clinic, marcadores] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { whatsapp: true } }),
    prisma.marcador.findMany({ where: { clinicId, active: true }, orderBy: { name: "asc" } }),
  ]);
  return marcadores.map((m) => ({
    phone: m.phone,
    variables: { nome: m.name, link: clinic?.whatsapp ? buildMarcadorLink(clinic.whatsapp, m) : "" },
  }));
}

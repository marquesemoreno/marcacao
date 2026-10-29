"use server";

import OpenAI from "openai";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicManager } from "@/lib/session";
import { periodWindow, type PeriodKey } from "@/lib/report-period";
import { NON_PATIENT_TAG } from "@/lib/conversation-tags";
import { fetchBridgeDailyAgendaOrNull } from "@/lib/hospital-bridge";
import { computeAgendaRisk, computeNewVsReturning, computeWeeklyTrend } from "@/lib/report-insights";

/** Mesmo recorte do relatório: sem conversas "Administrativo" nem "Não é paciente". */
const NOT_ADMINISTRATIVE = {
  OR: [{ resolutionReason: null }, { resolutionReason: { not: "ADMINISTRATIVO" } }],
  NOT: { tags: { has: NON_PATIENT_TAG } },
};

/** Agenda de um dia já passado não muda mais — guarda 12 h pra não bater no PC da clínica
 * a cada abertura do relatório (e funcionar à noite, quando a Urolaser desliga o servidor). */
const cachedPastAgenda = unstable_cache(
  async (clinicId: string, date: string) => fetchBridgeDailyAgendaOrNull(clinicId, date),
  ["report-bridge-agenda"],
  { revalidate: 43_200 }
);

const MAX_AGENDA_DAYS = 31;

function isoDay(utcMs: number) {
  return new Date(utcMs - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Tendência semanal, pacientes novos x retorno e risco de falta da agenda do sistema da clínica. */
export async function getClinicReportInsights(period: PeriodKey = "30") {
  const { clinicId } = await requireClinicManager();
  const { since, until } = periodWindow(period, false);
  const end = until ?? new Date();

  const conversations = await prisma.conversation.findMany({
    where: { clinicId, createdAt: { gte: since, lt: end }, AND: [NOT_ADMINISTRATIVE] },
    select: { contactId: true, createdAt: true, resolutionReason: true },
  });
  const trend = computeWeeklyTrend(
    conversations.map((c) => ({ createdAt: c.createdAt, scheduled: c.resolutionReason === "AGENDAMENTO_CONCLUIDO" })),
    since,
    end
  );

  // Novos x retorno: quem ESCREVEU no período (a conversa é reaberta quando o paciente
  // volta, então "conversa criada no período" só pegaria novos) e desde quando fala com a clínica.
  const active = await prisma.conversation.findMany({
    where: { clinicId, AND: [NOT_ADMINISTRATIVE], messages: { some: { direction: "INBOUND", createdAt: { gte: since, lt: end } } } },
    select: { contactId: true, createdAt: true },
  });
  const patients = computeNewVsReturning(
    active.map((c) => ({ contactId: c.contactId, firstConversationAt: c.createdAt })),
    since
  );

  // Agenda do bridge: só clínicas com integração; no máximo os últimos 31 dias do período.
  const integration = await prisma.hospitalIntegration.findUnique({ where: { clinicId }, select: { active: true } });
  let agenda: (ReturnType<typeof computeAgendaRisk> & { days: number; missingDays: number; from: string; to: string }) | null = null;
  if (integration?.active) {
    const today = isoDay(Date.now());
    const lastDay = Math.min(end.getTime() - 1, Date.now());
    const firstDay = Math.max(since.getTime(), lastDay - (MAX_AGENDA_DAYS - 1) * 86_400_000);
    const days: string[] = [];
    for (let t = firstDay; t <= lastDay; t += 86_400_000) days.push(isoDay(t));
    const unique = [...new Set(days)];
    const results: (Awaited<ReturnType<typeof fetchBridgeDailyAgendaOrNull>>)[] = [];
    for (let i = 0; i < unique.length; i += 6) {
      const batch = unique.slice(i, i + 6);
      results.push(...(await Promise.all(batch.map((d) => (d < today ? cachedPastAgenda(clinicId, d) : fetchBridgeDailyAgendaOrNull(clinicId, d))))));
    }
    const items = unique.flatMap((date, i) => (results[i] ?? []).map((a) => ({ numero: a.numero, medico: a.medico, date })));
    const logs = items.length
      ? await prisma.bridgeReminderLog.findMany({
          where: { clinicId, bridgeNumero: { in: items.map((i) => i.numero) } },
          select: { bridgeNumero: true, response: true },
        })
      : [];
    const responses = new Map(logs.map((l) => [l.bridgeNumero, l.response]));
    agenda = {
      ...computeAgendaRisk(items, responses),
      days: unique.length,
      missingDays: results.filter((r) => r === null).length,
      from: unique[0] ?? "",
      to: unique.at(-1) ?? "",
    };
  }

  return { trend, patients, agenda };
}

/** Resumo do período em linguagem simples, a partir dos fatos já calculados no relatório
 * (a IA não vê dado de paciente, só os números). Sem chave ou com erro: devolve null e a
 * tela mostra os fatos em lista. */
export async function generateReportSummary(input: { clinicName: string; periodLabel: string; facts: string[] }): Promise<{ text: string | null }> {
  await requireClinicManager();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || input.facts.length === 0) return { text: null };
  try {
    const openai = new OpenAI({ apiKey });
    const r = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "Você é analista de uma clínica médica e escreve para a gestora, em português do Brasil, sem jargão. Use SOMENTE os fatos fornecidos — não invente números nem causas. Responda em 2 partes: 1) um parágrafo curto (até 3 frases) com o que mais importa no período; 2) até 3 ações práticas para a recepção ou gestão, em lista com '- '. Não use títulos nem negrito.",
        },
        { role: "user", content: `Clínica: ${input.clinicName}\nPeríodo: ${input.periodLabel}\nFatos:\n${input.facts.map((f) => `- ${f}`).join("\n")}` },
      ],
    });
    return { text: r.choices[0]?.message?.content?.trim() || null };
  } catch {
    return { text: null };
  }
}

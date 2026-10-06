import { describe, it, expect } from "vitest";
import {
  computeAttendantPerformance,
  computeConfirmationStats,
  computeTopDoctors,
  classifyAppointmentKind,
  computeKindDistribution,
  computeHourlyInbound,
  computeBridgeConfirmationStats,
  mergeConfirmationStats,
  computeChannelConversion,
  computeResponseStats,
} from "./report-metrics";

describe("computeAttendantPerformance", () => {
  it("agrupa por atendente, calcula FRT médio e conversão, ordena por conversão", () => {
    const rows = computeAttendantPerformance([
      { userId: "a", userName: "Ana", status: "RESOLVED", resolutionReason: "AGENDAMENTO_CONCLUIDO", firstResponseSec: 60 },
      { userId: "a", userName: "Ana", status: "RESOLVED", resolutionReason: "DUVIDA", firstResponseSec: 120 },
      { userId: "b", userName: "Bia", status: "RESOLVED", resolutionReason: "AGENDAMENTO_CONCLUIDO", firstResponseSec: null },
      { userId: "b", userName: "Bia", status: "OPEN", resolutionReason: null, firstResponseSec: 30 },
      { userId: null, userName: null, status: "RESOLVED", resolutionReason: "AGENDAMENTO_CONCLUIDO", firstResponseSec: 10 },
    ]);
    expect(rows).toEqual([
      { userId: "b", userName: "Bia", total: 2, scheduled: 1, conversionRate: 100, avgFrtSec: 30 },
      { userId: "a", userName: "Ana", total: 2, scheduled: 1, conversionRate: 50, avgFrtSec: 90 },
    ]);
  });
});

describe("computeConfirmationStats", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  it("conta confirmados, cancelados e sem retorno só entre agendamentos com lembrete enviado", () => {
    const stats = computeConfirmationStats(
      [
        { reminderSentAt: new Date(), reminderStatus: "CONFIRMED", status: "CONFIRMED", date: new Date("2026-09-26") },
        { reminderSentAt: new Date(), reminderStatus: "SENT", status: "CANCELLED", date: new Date("2026-09-26") },
        { reminderSentAt: new Date(), reminderStatus: "SENT", status: "PENDING", date: new Date("2026-09-20") },
        { reminderSentAt: new Date(), reminderStatus: "SENT", status: "PENDING", date: new Date("2026-09-30") },
        { reminderSentAt: null, reminderStatus: "PENDING", status: "PENDING", date: new Date("2026-09-20") },
      ],
      now
    );
    expect(stats).toEqual({
      totalSent: 4,
      confirmed: 1,
      confirmedPct: 25,
      cancelled: 1,
      cancelledPct: 25,
      rescheduled: 0,
      rescheduledPct: 0,
      noReply: 1,
      noReplyPct: 25,
    });
  });
});

describe("computeTopDoctors", () => {
  it("agrupa ignorando caixa/acentos, retorna top N em title case", () => {
    const top = computeTopDoctors(["JOÃO SILVA", "João Silva", "ANA LIMA", null, "  "], 5);
    expect(top).toEqual([
      { name: "João Silva", count: 2 },
      { name: "Ana Lima", count: 1 },
    ]);
  });
});

describe("classifyAppointmentKind", () => {
  it("retorno pelo nome, consulta pela categoria, resto é exame/procedimento", () => {
    expect(classifyAppointmentKind("Retorno Urologia", "CONSULTATION")).toBe("RETORNO");
    expect(classifyAppointmentKind("Consulta Urologia", "CONSULTATION")).toBe("CONSULTA");
    expect(classifyAppointmentKind("Ultrassom", "EXAM")).toBe("EXAME");
    expect(classifyAppointmentKind("Vasectomia", "SURGERY")).toBe("EXAME");
  });

  it("distribuição conta os três tipos", () => {
    expect(
      computeKindDistribution([
        { procedureName: "Consulta", category: "CONSULTATION" },
        { procedureName: "Retorno", category: "CONSULTATION" },
        { procedureName: "Exame", category: "EXAM" },
        { procedureName: "Consulta 2", category: "CONSULTATION" },
      ])
    ).toEqual({ CONSULTA: 2, RETORNO: 1, EXAME: 1 });
  });
});

describe("computeHourlyInbound", () => {
  it("agrupa 08h–18h no fuso de São Paulo, descartando fora da faixa", () => {
    const buckets = computeHourlyInbound([
      new Date("2026-09-25T11:30:00Z"), // 08:30 BRT
      new Date("2026-09-25T11:59:00Z"), // 08:59 BRT
      new Date("2026-09-25T21:10:00Z"), // 18:10 BRT
      new Date("2026-09-25T02:00:00Z"), // 23:00 BRT (fora)
    ]);
    expect(buckets).toHaveLength(11);
    expect(buckets[0]).toEqual({ hour: 8, count: 2 });
    expect(buckets[10]).toEqual({ hour: 18, count: 1 });
  });
});

describe("computeBridgeConfirmationStats", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  it("conta respostas dos lembretes do bridge; sem retorno só depois de 1 dia sem resposta", () => {
    expect(
      computeBridgeConfirmationStats(
        [
          { response: "CONFIRMED", sentAt: new Date("2026-09-27T10:00:00Z") },
          { response: "CANCELLED", sentAt: new Date("2026-09-27T10:00:00Z") },
          { response: "RESCHEDULE", sentAt: new Date("2026-09-27T10:00:00Z") },
          { response: null, sentAt: new Date("2026-09-26T10:00:00Z") },
          { response: null, sentAt: new Date("2026-09-28T10:00:00Z") },
        ],
        now
      )
    ).toEqual({ sent: 5, confirmed: 1, cancelled: 1, rescheduled: 1, noReply: 1 });
  });

  it("mergeConfirmationStats soma as duas fontes e recalcula %", () => {
    const merged = mergeConfirmationStats(
      { totalSent: 2, confirmed: 1, confirmedPct: 50, cancelled: 0, cancelledPct: 0, rescheduled: 0, rescheduledPct: 0, noReply: 1, noReplyPct: 50 },
      { sent: 2, confirmed: 1, cancelled: 0, rescheduled: 1, noReply: 0 }
    );
    expect(merged).toEqual({
      totalSent: 4, confirmed: 2, confirmedPct: 50, cancelled: 0, cancelledPct: 0, rescheduled: 1, rescheduledPct: 25, noReply: 1, noReplyPct: 25,
    });
  });
});

describe("computeChannelConversion", () => {
  it("agrupa por canal (null = Não identificado), conversão sobre resolvidas, ordena por agendamentos", () => {
    const rows = computeChannelConversion(
      [
        { acquisitionChannel: "Instagram Ads", status: "RESOLVED", resolutionReason: "AGENDAMENTO_CONCLUIDO" },
        { acquisitionChannel: "Instagram Ads", status: "RESOLVED", resolutionReason: "DUVIDA" },
        { acquisitionChannel: "Instagram Ads", status: "OPEN", resolutionReason: null },
        { acquisitionChannel: null, status: "RESOLVED", resolutionReason: "AGENDAMENTO_CONCLUIDO" },
        { acquisitionChannel: null, status: "RESOLVED", resolutionReason: "AGENDAMENTO_CONCLUIDO" },
      ],
      200
    );
    expect(rows).toEqual([
      { channel: "Não identificado", conversations: 2, scheduled: 2, conversionRate: 100, estimatedRevenue: 400 },
      { channel: "Instagram Ads", conversations: 3, scheduled: 1, conversionRate: 50, estimatedRevenue: 200 },
    ]);
  });

  it("sem ticket, receita estimada é null", () => {
    expect(computeChannelConversion([{ acquisitionChannel: "X", status: "OPEN", resolutionReason: null }], null)[0].estimatedRevenue).toBeNull();
  });
});

describe("computeResponseStats", () => {
  // segunda 2026-09-07, expediente padrão 08–18h (UTC-3)
  const at = (hhmm: string) => new Date(`2026-09-07T${hhmm}:00-03:00`);
  it("mediana em minutos de expediente, ignora sem resposta, % dentro do SLA", () => {
    const stats = computeResponseStats(
      [
        { firstInboundAt: at("09:00"), firstHumanReplyAt: at("09:05"), resolvedAt: at("10:00") },
        { firstInboundAt: at("09:00"), firstHumanReplyAt: at("09:20"), resolvedAt: null },
        { firstInboundAt: at("09:00"), firstHumanReplyAt: at("11:00"), resolvedAt: at("12:00") },
        { firstInboundAt: at("09:00"), firstHumanReplyAt: null, resolvedAt: at("09:30") },
      ],
      null
    );
    expect(stats).toEqual({ answered: 3, unanswered: 1, medianFirstResponseMin: 20, medianResolutionMin: 120, withinSlaPct: 33.3 });
  });

  it("mensagem fora do expediente só conta a partir da abertura", () => {
    const stats = computeResponseStats(
      [{ firstInboundAt: new Date("2026-09-04T22:00:00Z"), firstHumanReplyAt: new Date("2026-09-07T11:10:00Z"), resolvedAt: null }],
      { seg: { open: "08:00", close: "18:00" }, ter: { closed: true }, qua: { closed: true }, qui: { closed: true }, sex: { open: "08:00", close: "18:00" }, sab: { closed: true }, dom: { closed: true } }
    );
    expect(stats.medianFirstResponseMin).toBe(10);
  });

  it("sem conversas respondidas devolve null", () => {
    expect(computeResponseStats([], null)).toEqual({ answered: 0, unanswered: 0, medianFirstResponseMin: null, medianResolutionMin: null, withinSlaPct: null });
  });
});

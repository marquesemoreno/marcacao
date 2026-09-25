import { describe, it, expect } from "vitest";
import {
  computeAttendantPerformance,
  computeConfirmationStats,
  computeTopDoctors,
  classifyAppointmentKind,
  computeKindDistribution,
  computeHourlyInbound,
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

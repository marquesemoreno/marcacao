import { describe, it, expect } from "vitest";
import {
  buildBridgeReminderMessage,
  buildUrolaserLaraReminderMessage,
  LARA_CONFIRMATION_MARKER,
  nextReminderTargetDate,
} from "./bridge-reminder";

describe("buildBridgeReminderMessage", () => {
  const base = {
    patientName: "Maria Silva",
    clinicName: "Urolaser",
    procedureName: "Ultrassom de Próstata",
    doctorName: "João Souza",
    time: "14:30",
    dateFormatted: "04/09/2026",
  };

  it("inclui procedimento, médico e horário quando presentes", () => {
    const message = buildBridgeReminderMessage(base);
    expect(message).toContain("Maria Silva");
    expect(message).toContain("Ultrassom de Próstata");
    expect(message).toContain("João Souza");
    expect(message).toContain("14:30");
    expect(message).toContain("04/09/2026");
    expect(message).toContain("Urolaser");
    const lines = message.split("\n").map((l) => l.trim());
    expect(lines).toContain("1️⃣ Digite 1 para Confirmar presença");
    expect(lines).toContain("2️⃣ Digite 2 para Remarcar");
    expect(lines).toContain("3️⃣ Digite 3 para Cancelar");
  });

  it("coloca nome do paciente e do médico em title case e negrito (vêm em CAIXA ALTA do Firebird)", () => {
    const message = buildBridgeReminderMessage({
      ...base,
      patientName: "FLORISVALDO DE OLIVEIRA FREITAS",
      doctorName: "MAURICIO FAGNER SANTOS LIMA DIAS",
    });
    expect(message).toContain("*Florisvaldo de Oliveira Freitas*");
    expect(message).toContain("*Mauricio Fagner Santos Lima Dias*");
    expect(message).not.toContain("FLORISVALDO");
    expect(message).not.toContain("MAURICIO FAGNER");
  });

  it("não quebra quando procedimento, médico ou horário vêm vazios do Firebird", () => {
    const message = buildBridgeReminderMessage({
      ...base,
      procedureName: null,
      doctorName: null,
      time: null,
    });
    expect(message).toContain("Maria Silva");
    expect(message).toContain("04/09/2026");
    expect(message).not.toContain("null");
    expect(message).not.toContain("undefined");
  });
});

describe("buildUrolaserLaraReminderMessage", () => {
  const base = {
    patientName: "Vivaldo José de Oliveira",
    clinicName: "Urolaser",
    procedureName: "Ultrassom de Próstata",
    doctorName: "João Souza",
    time: "09:30",
    dateFormatted: "20/02/2026",
  };

  it("apresenta a Lara e inclui os dados do agendamento", () => {
    const message = buildUrolaserLaraReminderMessage(base);
    expect(message).toContain("Vivaldo José de Oliveira");
    expect(message).toContain("Lara");
    expect(message).toContain("Urolaser");
    expect(message).toContain("20/02/2026");
    expect(message).toContain("09:30");
    expect(message).toContain("atendimento por ordem de chegada");
    expect(message).toContain(LARA_CONFIRMATION_MARKER);
  });

  it("mostra 'Consulta com Dr. X' quando o procedimento é consulta, com nomes em title case", () => {
    const message = buildUrolaserLaraReminderMessage({
      ...base,
      patientName: "DAVI GRALHA PEREIRA",
      procedureName: "CONSULTA UROLOGIA",
      doctorName: "ALAN PASCOAL SILVA SANTOS",
    });
    expect(message).toContain("*Davi Gralha Pereira*");
    expect(message).toContain("uma Consulta com Dr. *Alan Pascoal Silva Santos*");
    expect(message).not.toContain("CONSULTA UROLOGIA");
    expect(message).not.toContain("ALAN PASCOAL SILVA SANTOS");
  });

  it("mostra o nome do exame (não 'Consulta') quando não é uma consulta", () => {
    const message = buildUrolaserLaraReminderMessage({
      ...base,
      procedureName: "URODINAMICA COMPLETA",
      doctorName: "DANILO LEITE ANDRADE",
    });
    expect(message).toContain("Urodinamica Completa com Dr. *Danilo Leite Andrade*");
    expect(message).not.toContain("uma Consulta");
  });

  it("pede resposta SIM/NÃO em negrito, em vez de menu numerado ou texto livre", () => {
    const message = buildUrolaserLaraReminderMessage(base);
    expect(message).toContain("responda *SIM* para confirmar sua presença");
    expect(message).toContain("responda *NÃO*");
  });

  it("não usa menu numerado nem link/telefone externo", () => {
    const message = buildUrolaserLaraReminderMessage(base);
    expect(message).not.toMatch(/digite \d/i);
    expect(message).not.toContain("wa.me");
    expect(message).not.toMatch(/\(\d{2}\)\s?\d{4}/);
  });

  it("não quebra quando procedimento, médico ou horário vêm vazios do Firebird", () => {
    const message = buildUrolaserLaraReminderMessage({
      ...base,
      procedureName: null,
      doctorName: null,
      time: null,
    });
    expect(message).toContain("Vivaldo José de Oliveira");
    expect(message).toContain("20/02/2026");
    expect(message).not.toContain("null");
    expect(message).not.toContain("undefined");
  });
});

describe("nextReminderTargetDate", () => {
  // America/Bahia é UTC-3 o ano todo (sem horário de verão) — hora local `hour` num
  // dia (Y,M,D) corresponde a `hour + 3` em UTC no mesmo dia.
  function atBahia(year: number, month: number, day: number, hour = 9): Date {
    return new Date(Date.UTC(year, month, day, hour + 3, 0, 0));
  }

  it("sem skipWeekends, sexta manda pra sábado (comportamento de sempre)", () => {
    // 2026-09-18 é sexta-feira.
    const result = nextReminderTargetDate(atBahia(2026, 8, 18), false);
    expect(result.iso).toBe("2026-09-19");
    expect(result.formatted).toBe("19/09/2026");
  });

  it("com skipWeekends, sexta pula sábado e domingo e manda pra segunda", () => {
    const result = nextReminderTargetDate(atBahia(2026, 8, 18), true);
    expect(result.iso).toBe("2026-09-21");
    expect(result.formatted).toBe("21/09/2026");
  });

  it("com skipWeekends, sábado também pula pra segunda (não pra domingo)", () => {
    // 2026-09-19 é sábado.
    const result = nextReminderTargetDate(atBahia(2026, 8, 19), true);
    expect(result.iso).toBe("2026-09-21");
  });

  it("com skipWeekends, dia de semana normal não muda (terça manda pra quarta)", () => {
    // 2026-09-15 é terça-feira.
    const result = nextReminderTargetDate(atBahia(2026, 8, 15), true);
    expect(result.iso).toBe("2026-09-16");
  });
});

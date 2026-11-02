import { describe, it, expect } from "vitest";
import { greetingFirstName } from "./format";
import { buildBridgeReminderMessage, buildUrolaserLaraReminderMessage } from "./bridge-reminder";
import { buildBridgeConfirmationMessage } from "./bridge-confirmation";
import { reminderTemplateParams } from "./reminder-template";
import { guardianReminderIntro } from "./reminder-recipient";
import { isWrongNumberReply, wrongNumberCheckLine } from "./appointment-reply";

const input = { patientName: "JULIO MORENO DA SILVA", clinicName: "Clínica X", procedureName: null, doctorName: "CARLOS DE SOUZA", time: "08:00", dateFormatted: "02/11/2026" };

describe("greetingFirstName", () => {
  it("só o primeiro nome, sem caixa alta", () => {
    expect(greetingFirstName("JULIO MORENO DA SILVA")).toBe("Julio");
    expect(greetingFirstName("  maria  ")).toBe("Maria");
    expect(greetingFirstName("")).toBe("");
  });
});

describe("mensagens automáticas usam o primeiro nome", () => {
  it("lembrete D-1", () => {
    const m = buildBridgeReminderMessage(input);
    expect(m).toContain("Olá, *Julio*!");
    expect(m).not.toContain("JULIO");
    expect(m).toContain("Dr(a). *Carlos de Souza*");
  });
  it("lembrete Lara", () => {
    expect(buildUrolaserLaraReminderMessage(input)).toContain("Olá, *Julio*!");
  });
  it("confirmação de agendamento", () => {
    const m = buildBridgeConfirmationMessage({ patientName: "JULIO MORENO DA SILVA", doctorName: null, dateFormatted: "02/11/2026", time: "08:00" });
    expect(m.startsWith("Olá, Julio!")).toBe(true);
  });
  it("modelo da API oficial: primeiro nome e médico sem caixa alta", () => {
    expect(reminderTemplateParams(input)).toEqual(["Julio", "02/11/2026", "08:00", "Carlos de Souza"]);
  });
  it("aviso ao responsável cita o paciente pelo nome completo, sem caixa alta", () => {
    expect(guardianReminderIntro("Ana", "PEDRO DA SILVA")).toContain("*Pedro da Silva*");
  });
});

describe("número errado", () => {
  it("linha de checagem cita o primeiro nome", () => {
    expect(wrongNumberCheckLine("JULIO MORENO")).toBe("Se este número não for do(a) Julio, responda *NÚMERO ERRADO* que corrigimos o cadastro.");
  });
  it("reconhece as respostas comuns", () => {
    for (const t of ["número errado", "NUMERO ERRADO!", "Não sou eu", "não sou o Julio", "engano", "não conheço", "nao conheco essa pessoa"]) {
      expect(isWrongNumberReply(t), t).toBe(true);
    }
  });
  it("não confunde com confirmação ou cancelamento", () => {
    for (const t of ["não", "sim", "não vou poder ir", "1", "não sou eu que vou, é minha mãe? pode?"]) {
      expect(isWrongNumberReply(t), t).toBe(false);
    }
  });
});

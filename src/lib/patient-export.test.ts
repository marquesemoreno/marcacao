import { describe, expect, it } from "vitest";
import { buildPatientExport, exportFileName, type PatientExportInput } from "./patient-export";

const input: PatientExportInput = {
  generatedAt: new Date("2026-11-18T15:00:00Z"),
  clinic: { name: "Clínica Exemplo Ltda", cnpj: "12345678000190" },
  contact: { name: "Maria da Silva", phone: "5577999887766", instagramUsername: null },
  profile: {
    cpf: "12345678901",
    rg: null,
    birthDate: new Date("1990-05-10T00:00:00Z"),
    address: "Rua A, 1",
    convenio: "Unimed",
    insuranceCardNumber: "999",
    preferredDoctor: "Dr. João",
    notes: "Observação da recepção",
    marketingConsentAt: new Date("2026-10-21T12:00:00Z"),
    marketingConsentSource: "whatsapp",
    guardianName: null,
    guardianRelationship: null,
    guardianPhone: null,
  },
  channelConsents: [{ channel: "SMS", address: "5577999887766", consentAt: new Date("2026-10-25T12:00:00Z"), revokedAt: null, source: "ficha" }],
  termAcceptances: [{ termTitle: "Termo de uso de dados", acceptedAt: new Date("2026-11-02T12:00:00Z") }],
  appointments: [{ date: new Date("2026-11-20T00:00:00Z"), timeSlot: "09:00", status: "CONFIRMED", procedure: "Consulta" }],
  messages: [
    { createdAt: new Date("2026-11-01T12:00:00Z"), direction: "INBOUND", type: "TEXT", content: "Oi, quero marcar" },
    { createdAt: new Date("2026-11-01T12:05:00Z"), direction: "OUTBOUND", type: "INTERNAL_NOTE", content: "Paciente difícil" },
    { createdAt: new Date("2026-11-01T12:06:00Z"), direction: "OUTBOUND", type: "TEXT", content: "Claro! Qual dia?" },
    { createdAt: new Date("2026-11-01T12:07:00Z"), direction: "INBOUND", type: "ATTACHMENT", content: null },
  ],
};

describe("buildPatientExport", () => {
  const out = buildPatientExport(input);
  const json = JSON.stringify(out);

  it("traz cadastro, perfil na clínica, consentimentos, agendamentos e mensagens", () => {
    expect(out.titular.nome).toBe("Maria da Silva");
    expect(out.titular.cpf).toBe("12345678901");
    expect(out.titular.dataDeNascimento).toBe("1990-05-10");
    expect(out.consentimentos.marketing).toEqual({ aceitoEm: "2026-10-21T12:00:00.000Z", origem: "whatsapp" });
    expect(out.consentimentos.canais).toHaveLength(1);
    expect(out.consentimentos.termos[0].termo).toBe("Termo de uso de dados");
    expect(out.agendamentos[0]).toMatchObject({ data: "2026-11-20", horario: "09:00", situacao: "CONFIRMED", servico: "Consulta" });
    expect(out.clinica).toEqual({ nome: "Clínica Exemplo Ltda", cnpj: "12.345.678/0001-90" });
  });

  it("nunca leva nota interna da equipe", () => {
    expect(json).not.toContain("Paciente difícil");
    expect(out.mensagens.map((m) => m.texto)).toEqual(["Oi, quero marcar", "Claro! Qual dia?", "[arquivo]"]);
  });

  it("diz quem escreveu cada mensagem", () => {
    expect(out.mensagens.map((m) => m.de)).toEqual(["paciente", "clínica", "paciente"]);
  });

  it("sem perfil na clínica: campos vazios, sem quebrar", () => {
    const empty = buildPatientExport({ ...input, profile: null });
    expect(empty.titular.cpf).toBeNull();
    expect(empty.consentimentos.marketing).toBeNull();
  });
});

describe("exportFileName", () => {
  it("não leva o nome do paciente no nome do arquivo", () => {
    expect(exportFileName(new Date("2026-11-18T02:00:00Z"))).toBe("dados-do-titular-2026-11-17.json");
  });
});

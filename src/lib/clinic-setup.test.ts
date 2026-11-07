import { describe, expect, it } from "vitest";
import { clinicSetupChecklist, type ClinicSetupInput } from "./clinic-setup";

const empty: ClinicSetupInput = {
  users: 0,
  procedures: 0,
  whatsappConnected: false,
  cloudActive: false,
  hasBusinessHours: false,
  hasDefaultTicket: false,
  hasTechnicalDirector: false,
  knowledgeEntries: 0,
  hasBridge: false,
  hasGoogleReview: false,
};

describe("checklist de clínica nova", () => {
  it("clínica recém-criada: nada pronto, só obrigatórios contam no progresso", () => {
    const c = clinicSetupChecklist(empty);
    expect(c.ready).toBe(false);
    expect(c.done).toBe(0);
    expect(c.required).toBe(5);
    expect(c.items.map((i) => i.key)).toEqual([
      "equipe",
      "whatsapp",
      "procedimentos",
      "horario",
      "ticket",
      "responsavel",
      "conhecimento",
      "ponte",
      "google",
    ]);
  });

  it("API oficial ativa conta como WhatsApp; pronta quando os obrigatórios estão feitos", () => {
    const c = clinicSetupChecklist({ ...empty, users: 2, procedures: 10, cloudActive: true, hasBusinessHours: true, hasDefaultTicket: true });
    expect(c.ready).toBe(true);
    expect(c.done).toBe(5);
    expect(c.items.find((i) => i.key === "responsavel")).toMatchObject({ done: false, required: false });
  });
});

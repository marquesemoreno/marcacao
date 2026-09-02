import { describe, it, expect } from "vitest";
import { isTeamQueueUser, formatAgentDisplayName } from "./team-queue";

describe("isTeamQueueUser", () => {
  it("reconhece a conta de equipe mesmo com acentuação diferente entre user.name e clinic.tradeName", () => {
    // Bug real de produção: o usuário sintético da Santa Clara foi cadastrado sem
    // acento ("Equipe Clinica Cirurgica Santa Clara"), mas o tradeName da clínica
    // tem acento ("Clínica Cirúrgica Santa Clara") — comparação exata nunca batia,
    // e a conversa "transferida pra equipe" ficava presa nesse usuário fake em vez
    // de cair em Não Atribuídas.
    const user = {
      name: "Equipe Clinica Cirurgica Santa Clara",
      clinic: { tradeName: "Clínica Cirúrgica Santa Clara" },
    };

    expect(isTeamQueueUser(user)).toBe(true);
  });

  it("reconhece quando a acentuação já bate certinho", () => {
    const user = {
      name: "Equipe Urolaser - Clínica de Urologia e Diagnóstico",
      clinic: { tradeName: "Urolaser - Clínica de Urologia e Diagnóstico" },
    };

    expect(isTeamQueueUser(user)).toBe(true);
  });

  it("não confunde um atendente de verdade com a conta de equipe", () => {
    const user = {
      name: "Jamile Cardozo",
      clinic: { tradeName: "Clínica Cirúrgica Santa Clara" },
    };

    expect(isTeamQueueUser(user)).toBe(false);
  });

  it("retorna false quando não há clínica associada", () => {
    expect(isTeamQueueUser({ name: "Equipe Alguma Coisa", clinic: null })).toBe(false);
  });
});

describe("formatAgentDisplayName", () => {
  it("troca qualquer conta 'Equipe X' por Não Atribuídas, pra qualquer clínica", () => {
    expect(formatAgentDisplayName("Equipe Clinica Cirurgica Santa Clara")).toBe("Não Atribuídas");
    expect(formatAgentDisplayName("Equipe Urolaser - Clínica de Urologia e Diagnóstico")).toBe("Não Atribuídas");
  });

  it("acrescenta o nome da clínica quando informado (lista que mistura várias clínicas, ex: admin)", () => {
    expect(formatAgentDisplayName("Equipe Clinica Cirurgica Santa Clara", "Clínica Cirúrgica Santa Clara")).toBe(
      "Não Atribuídas — Clínica Cirúrgica Santa Clara"
    );
  });

  it("não mexe no nome de um atendente de verdade", () => {
    expect(formatAgentDisplayName("Jamile Cardozo")).toBe("Jamile Cardozo");
  });
});

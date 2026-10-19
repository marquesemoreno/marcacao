import { describe, it, expect } from "vitest";
import { fillCannedVariables, CANNED_VARIABLES } from "./canned-variables";

describe("fillCannedVariables", () => {
  it("troca {{nome}} pelo primeiro nome do paciente", () => {
    expect(fillCannedVariables("Olá {{nome}}, tudo bem?", { nome: "Maria da Silva" })).toBe("Olá Maria, tudo bem?");
  });

  it("troca data, médico e clínica", () => {
    const out = fillCannedVariables("Dr(a). {{medico}} te espera em {{data}} na {{clinica}}.", {
      medico: "Ana Souza",
      data: "20/10/2026",
      clinica: "Urolaser",
    });
    expect(out).toBe("Dr(a). Ana Souza te espera em 20/10/2026 na Urolaser.");
  });

  it("aceita espaços e maiúsculas dentro das chaves", () => {
    expect(fillCannedVariables("Oi {{ Nome }}!", { nome: "João Pedro" })).toBe("Oi João!");
  });

  it("troca todas as ocorrências da mesma variável", () => {
    expect(fillCannedVariables("{{nome}}, {{nome}}!", { nome: "Lia" })).toBe("Lia, Lia!");
  });

  it("deixa a variável visível quando não há valor, para a atendente preencher", () => {
    expect(fillCannedVariables("Dr(a). {{medico}}", {})).toBe("Dr(a). {{medico}}");
    expect(fillCannedVariables("Dr(a). {{medico}}", { medico: "  " })).toBe("Dr(a). {{medico}}");
    expect(fillCannedVariables("Oi {{nome}}", { nome: null })).toBe("Oi {{nome}}");
  });

  it("não mexe em variáveis desconhecidas nem em texto sem variáveis", () => {
    expect(fillCannedVariables("Código {{xyz}}", { nome: "A" })).toBe("Código {{xyz}}");
    expect(fillCannedVariables("Sem variáveis", { nome: "A" })).toBe("Sem variáveis");
  });

  it("expõe a lista de variáveis suportadas para a tela de atalhos", () => {
    expect(CANNED_VARIABLES.map((v) => v.key)).toEqual(["nome", "data", "medico", "clinica"]);
  });
});

import { describe, it, expect } from "vitest";
import { formatProcedureName } from "./procedure-name";

describe("formatProcedureName", () => {
  it("remove o sufixo de Bridge (nome, clínica e tudo entre eles)", () => {
    expect(formatProcedureName("CONSULTA — Clínica Cirúrgica Santa Clara (Bridge)")).toBe("Consulta");
    expect(formatProcedureName("CISTOSCOPIA — Urolaser - Clínica de Urologia e Diagnóstico (Bridge)")).toBe(
      "Cistoscopia"
    );
  });

  it("converte ALL CAPS pra Title Case com conectores em minúsculo", () => {
    expect(formatProcedureName("CONSULTA UROLOGIA — Urolaser - Clínica de Urologia e Diagnóstico (Bridge)")).toBe(
      "Consulta Urologia"
    );
    expect(
      formatProcedureName(
        "EXERESE DE LESAO / TUMOR DE PELE E MUCOSAS — Clínica Cirúrgica Santa Clara (Bridge)"
      )
    ).toBe("Exérese de Lesão / Tumor de Pele e Mucosas");
  });

  it("aplica o dicionário de acentos em termos médicos comuns sem acento na origem", () => {
    expect(formatProcedureName("URODINAMICA COMPLETA — Urolaser - Clínica de Urologia e Diagnóstico (Bridge)")).toBe(
      "Urodinâmica Completa"
    );
    expect(
      formatProcedureName("CONSULTA CIRURGIA PEDIATRICA — Urolaser - Clínica de Urologia e Diagnóstico (Bridge)")
    ).toBe("Consulta Cirurgia Pediátrica");
    expect(formatProcedureName("COLONOSCOPIA (AMOR SAUDE) — Clínica Cirúrgica Santa Clara (Bridge)")).toBe(
      "Colonoscopia (Amor Saúde)"
    );
  });

  it("recupera os 3 casos reais com byte corrompido (�) via dicionário, e limpa o resto por fallback", () => {
    expect(
      formatProcedureName(
        "USG PROSTATA � VIA TRANSRETAL — Urolaser - Clínica de Urologia e Diagnóstico (Bridge)"
      )
    ).toBe("USG Próstata Via Transretal");
    expect(
      formatProcedureName("ENDOSCOPIA DIGESTIVA  ALTA (AMOR SA�DE) — Clínica Cirúrgica Santa Clara (Bridge)")
    ).toBe("Endoscopia Digestiva Alta (Amor Saúde)");
    expect(
      formatProcedureName(
        "CONSULTA EM CONSULT�RIO - UROLOGIA — Urolaser - Clínica de Urologia e Diagnóstico (Bridge)"
      )
    ).toBe("Consulta em Consultório - Urologia");
  });

  it("mantém sigla curta (USG) sem virar Title Case", () => {
    expect(formatProcedureName("USG ABDOME — Clínica X (Bridge)")).toBe("USG Abdome");
  });

  it("nome sem sufixo de Bridge e já normal passa praticamente inalterado", () => {
    expect(formatProcedureName("Consulta de Retorno")).toBe("Consulta De Retorno".replace("De", "de"));
  });

  it("é idempotente — formatar de novo o resultado já formatado não muda nada", () => {
    const once = formatProcedureName("BIOPSIA DE PROSTATA  (ANESTESIA LOCAL) — Urolaser - Clínica de Urologia e Diagnóstico (Bridge)");
    expect(once).toBe("Biópsia de Próstata (Anestesia Local)");
    expect(formatProcedureName(once)).toBe(once);
  });
});

import { describe, it, expect } from "vitest";
import { PromptSanitizer } from "./prompt-sanitizer";

const NOW = new Date("2026-11-09T12:00:00-03:00");

function mask(text: string, opts: ConstructorParameters<typeof PromptSanitizer>[0] = {}) {
  const s = new PromptSanitizer({ now: NOW, ...opts });
  return { s, out: s.mask(text) };
}

describe("PromptSanitizer — dados que já eram mascarados", () => {
  it("CPF, telefone e e-mail viram tokens e voltam no restore", () => {
    const { s, out } = mask("CPF 529.982.247-25, fone (77) 99100-0524, mail ana@gmail.com");
    expect(out).not.toMatch(/529|99100|ana@/);
    expect(s.restore(out)).toBe("CPF 529.982.247-25, fone (77) 99100-0524, mail ana@gmail.com");
  });

  it("o mesmo valor em mensagens diferentes vira o mesmo token (vault compartilhado)", () => {
    const s = new PromptSanitizer({ now: NOW });
    const a = s.mask("meu cpf 529.982.247-25");
    const b = s.mask("confirma o 529.982.247-25?");
    expect(a).toContain("{{PATIENT_CPF_1}}");
    expect(b).toContain("{{PATIENT_CPF_1}}");
  });
});

describe("PromptSanitizer — nomes", () => {
  it("nome completo conhecido, sem diferenciar acento nem maiúscula", () => {
    const { out } = mask("oi, aqui é otavio brandao", { knownNames: ["Otávio Brandão"] });
    expect(out).toBe("oi, aqui é {{PATIENT_NAME_1}}");
  });

  it("primeiro nome conhecido sozinho, quando escrito com inicial maiúscula", () => {
    const { out } = mask("Obrigada, Otávio! Até amanhã.", { knownNames: ["Otávio Brandão"] });
    expect(out).toBe("Obrigada, {{PATIENT_NAME_1}}! Até amanhã.");
  });

  it("não mascara pedaço de palavra", () => {
    const { out } = mask("Anabela marcou", { knownNames: ["Ana Souza"] });
    expect(out).toBe("Anabela marcou");
  });

  it("nome que o paciente se apresenta (\"meu nome é\", \"me chamo\", \"aqui é a\")", () => {
    expect(mask("Boa tarde, meu nome é Joana Dark Pereira e queria marcar").out).toBe(
      "Boa tarde, meu nome é {{PATIENT_NAME_1}} e queria marcar",
    );
    expect(mask("me chamo Carlos").out).toBe("me chamo {{PATIENT_NAME_1}}");
    expect(mask("Oi, aqui é a Beatriz da Silva").out).toBe("Oi, aqui é a {{PATIENT_NAME_1}}");
  });

  it("nome apresentado é mascarado também nas outras mensagens", () => {
    const s = new PromptSanitizer({ now: NOW });
    s.mask("me chamo Carlos Alberto");
    expect(s.mask("o Carlos Alberto vai sim")).toBe("o {{PATIENT_NAME_1}} vai sim");
  });

  it("termos preservados (nome da clínica) não são mascarados mesmo contendo o nome", () => {
    const { out } = mask("Clara, a Clínica Santa Clara confirma.", {
      knownNames: ["Clara Mendes"],
      preserveTerms: ["Clínica Santa Clara"],
    });
    expect(out).toBe("{{PATIENT_NAME_1}}, a Clínica Santa Clara confirma.");
  });
});

describe("PromptSanitizer — documentos e endereço", () => {
  it("data de nascimento (data com 3+ anos atrás) é mascarada; data de consulta não", () => {
    const { out } = mask("nasci em 14/03/1985, consulta dia 12/11/2026");
    expect(out).toBe("nasci em {{PATIENT_DATE_1}}, consulta dia 12/11/2026");
  });

  it("RG com a palavra RG antes", () => {
    expect(mask("RG: 12.345.678-9").out).toBe("RG: {{PATIENT_ID_1}}");
    expect(mask("meu rg 1234567").out).toBe("meu rg {{PATIENT_ID_1}}");
  });

  it("número da carteirinha / cartão SUS / matrícula", () => {
    expect(mask("carteirinha 0012 3456 7890 1234").out).toBe("carteirinha {{PATIENT_ID_1}}");
    expect(mask("cartão do SUS: 898 0012 3456 7891").out).toBe("cartão do SUS: {{PATIENT_ID_1}}");
    expect(mask("matrícula 445566-01").out).toBe("matrícula {{PATIENT_ID_1}}");
  });

  it("sequência longa de dígitos solta (15+) é tratada como identificador", () => {
    expect(mask("o número é 898001234567891").out).toBe("o número é {{PATIENT_ID_1}}");
  });

  it("CEP", () => {
    expect(mask("CEP 45000-123").out).toBe("CEP {{PATIENT_CEP_1}}");
    expect(mask("cep: 45000123").out).toBe("cep: {{PATIENT_CEP_1}}");
  });

  it("endereço com logradouro e número", () => {
    const { out } = mask("moro na Rua das Flores, 123, centro");
    expect(out).toBe("moro na {{PATIENT_ADDRESS_1}}, centro");
  });

  it("não mexe em texto clínico comum, horários e valores", () => {
    const text = "Dor ao urinar há 3 dias. Consulta às 14:30, valor R$ 180,00, retorno em 30 dias.";
    expect(mask(text).out).toBe(text);
  });
});

describe("PromptSanitizer — restore e contagem", () => {
  it("restore aceita token que a IA escreveu sem as chaves", () => {
    const s = new PromptSanitizer({ now: NOW, knownNames: ["Otávio Brandão"] });
    s.mask("Otávio Brandão");
    expect(s.restore("Olá PATIENT_NAME_1, tudo bem?")).toBe("Olá Otávio Brandão, tudo bem?");
    expect(s.restore("Olá {PATIENT_NAME_1}!")).toBe("Olá Otávio Brandão!");
  });

  it("token desconhecido não quebra o texto", () => {
    const s = new PromptSanitizer({ now: NOW });
    expect(s.restore("x {{PATIENT_NAME_9}} y")).toBe("x {{PATIENT_NAME_9}} y");
  });

  it("conta quantos valores distintos de cada tipo foram mascarados", () => {
    const s = new PromptSanitizer({ now: NOW, knownNames: ["Ana Souza"] });
    s.mask("Ana Souza, CPF 529.982.247-25, CPF de novo 529.982.247-25, fone (77) 99100-0524");
    expect(s.counts()).toEqual({ NAME: 1, CPF: 1, PHONE: 1 });
  });
});

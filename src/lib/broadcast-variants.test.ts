import { describe, it, expect } from "vitest";
import { pickBroadcastVariant, normalizeBroadcastVariants, previewBroadcastVariants, countSentByVariant } from "./broadcast-variants";
import { BROADCAST_OPT_OUT_FOOTER } from "./broadcast-csv";

describe("pickBroadcastVariant", () => {
  const variants = ["Olá {{nome}}, texto A", "Oi {{nome}}, texto B", "Bom dia {{nome}}, texto C"];

  it("o mesmo destinatário recebe sempre a mesma variação (reenvio após falha não troca o texto)", () => {
    const first = pickBroadcastVariant(variants, "cmrecipient123");
    for (let i = 0; i < 5; i++) expect(pickBroadcastVariant(variants, "cmrecipient123")).toEqual(first);
  });

  it("divide os destinatários entre as 3 variações de forma equilibrada", () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < 300; i++) counts[pickBroadcastVariant(variants, `cmrecipient${i}x`).index]++;
    for (const c of counts) expect(c).toBeGreaterThan(70);
  });

  it("devolve o texto da variação escolhida junto do índice", () => {
    const pick = pickBroadcastVariant(variants, "abc");
    expect(pick.text).toBe(variants[pick.index]);
  });

  it("com uma só mensagem, todos recebem ela (índice 0)", () => {
    expect(pickBroadcastVariant(["Única"], "qualquer")).toEqual({ index: 0, text: "Única" });
  });

  it("ignora variação em branco, sem mudar o índice das outras", () => {
    for (let i = 0; i < 50; i++) {
      const pick = pickBroadcastVariant(["Principal", "   ", "Terceira"], `r${i}`);
      expect(pick.index).not.toBe(1);
      expect(pick.text.trim()).not.toBe("");
    }
  });
});

describe("normalizeBroadcastVariants", () => {
  it("só a mensagem principal: uma variação, sem espaços nas pontas", () => {
    expect(normalizeBroadcastVariants("  Olá {{nome}}  ", [])).toEqual({ ok: true, variants: ["Olá {{nome}}"] });
  });

  it("junta principal + variações preenchidas e descarta as em branco", () => {
    expect(normalizeBroadcastVariants("A", ["  B ", "   "])).toEqual({ ok: true, variants: ["A", "B"] });
  });

  it("aceita no máximo 3 mensagens no total", () => {
    const r = normalizeBroadcastVariants("A", ["B", "C", "D"]);
    expect(r.ok).toBe(false);
  });

  it("recusa variação igual a outra (ignorando maiúsculas e espaços extras)", () => {
    const r = normalizeBroadcastVariants("Olá {{nome}}, tudo bem?", ["olá  {{nome}},  tudo bem?"]);
    expect(r).toEqual({ ok: false, error: "A variação 2 é igual a outra mensagem — escreva um texto diferente." });
  });

  it("recusa mensagem principal vazia", () => {
    expect(normalizeBroadcastVariants("   ", ["B"]).ok).toBe(false);
  });
});

describe("previewBroadcastVariants", () => {
  it("monta cada variação com as variáveis do primeiro destinatário, rodapé do RT e o 'digite 9'", () => {
    const out = previewBroadcastVariants(["Olá {{nome}}!", "Oi {{nome}}, novidade!"], { nome: "Maria" }, { technicalDirector: "Dr. X — CRM-BA 1" });
    expect(out.map((v) => v.text)).toEqual([
      `Olá Maria!

Responsável técnico: Dr. X — CRM-BA 1
${BROADCAST_OPT_OUT_FOOTER}`,
      `Oi Maria, novidade!

Responsável técnico: Dr. X — CRM-BA 1
${BROADCAST_OPT_OUT_FOOTER}`,
    ]);
  });

  it("aponta, por variação, variável que a planilha não tem e trecho [MAIÚSCULO] sem preencher", () => {
    const out = previewBroadcastVariants(["Olá {{nome}}", "Oi {{nome}}, seu {{exame}} em [DATA DO EXAME]"], { nome: "Maria" });
    expect(out[0]).toMatchObject({ unknownVariables: [], unfilled: [] });
    expect(out[1]).toMatchObject({ unknownVariables: ["exame"], unfilled: ["[DATA DO EXAME]"] });
  });
});

describe("countSentByVariant", () => {
  it("conta só quem recebeu (SENT), por variação, incluindo variação com zero", () => {
    const rows = [
      { status: "SENT", variantIndex: 0 },
      { status: "SENT", variantIndex: 0 },
      { status: "SENT", variantIndex: 2 },
      { status: "FAILED", variantIndex: 1 },
      { status: "PENDING", variantIndex: null },
    ];
    expect(countSentByVariant(rows, 3)).toEqual([2, 0, 1]);
  });

  it("campanha antiga (sem variação registrada) conta como mensagem principal", () => {
    expect(countSentByVariant([{ status: "SENT", variantIndex: null }], 1)).toEqual([1]);
  });
});

import { describe, it, expect } from "vitest";
import { buildTemplateParams, cloudBroadcastMode, renderTemplatePreview, checkTemplateParamSources } from "./broadcast-cloud-template";

describe("cloudBroadcastMode", () => {
  it("sem API oficial ativa: texto livre pela Evolution", () => {
    expect(cloudBroadcastMode({ cloudActive: false, templateName: null })).toBe("TEXT");
    expect(cloudBroadcastMode({ cloudActive: false, templateName: "promo" })).toBe("TEXT");
  });
  it("API oficial ativa com modelo: manda o modelo", () => {
    expect(cloudBroadcastMode({ cloudActive: true, templateName: "promo" })).toBe("TEMPLATE");
  });
  it("API oficial ativa sem modelo: não pode enviar (texto livre seria recusado)", () => {
    expect(cloudBroadcastMode({ cloudActive: true, templateName: null })).toBe("MISSING_TEMPLATE");
    expect(cloudBroadcastMode({ cloudActive: true, templateName: "  " })).toBe("MISSING_TEMPLATE");
  });
});

describe("buildTemplateParams", () => {
  it("troca as variáveis da planilha em cada parâmetro do modelo", () => {
    expect(buildTemplateParams(["{{nome}}", "{{data}} às {{hora}}"], { nome: "Maria", data: "30/10", hora: "9h" })).toEqual({
      ok: true,
      params: ["Maria", "30/10 às 9h"],
    });
  });
  it("aceita texto fixo como parâmetro", () => {
    expect(buildTemplateParams(["Urolaser"], {})).toEqual({ ok: true, params: ["Urolaser"] });
  });
  it("variável é procurada sem diferenciar maiúsculas", () => {
    expect(buildTemplateParams(["{{Nome}}"], { nome: "Ana" })).toEqual({ ok: true, params: ["Ana"] });
  });
  it("parâmetro que fica vazio é erro (a Meta recusa parâmetro vazio)", () => {
    const r = buildTemplateParams(["{{nome}}"], { nome: "  " });
    expect(r).toEqual({ ok: false, error: "O campo {{1}} do modelo ficou vazio para este paciente." });
  });
  it("tira quebras de linha e tabs, que a Meta não aceita em parâmetro", () => {
    expect(buildTemplateParams(["{{obs}}"], { obs: "linha1\nlinha2\t fim" })).toEqual({ ok: true, params: ["linha1 linha2 fim"] });
  });
});

describe("checkTemplateParamSources", () => {
  it("exige um valor para cada {{n}} do modelo", () => {
    expect(checkTemplateParamSources(2, ["{{nome}}"], ["nome"])).toBe("Preencha o que vai em {{2}} do modelo.");
  });
  it("aponta variável que a planilha não tem", () => {
    expect(checkTemplateParamSources(1, ["{{exame}}"], ["nome"])).toBe("A planilha não tem a coluna {{exame}} (usada em {{1}}).");
  });
  it("tudo certo: null", () => {
    expect(checkTemplateParamSources(2, ["{{nome}}", "Urolaser"], ["nome"])).toBeNull();
  });
});

describe("renderTemplatePreview", () => {
  it("mostra o texto do modelo com os parâmetros no lugar de {{n}}", () => {
    expect(renderTemplatePreview("Olá {{1}}, novidade da {{2}}!", ["Maria", "Urolaser"])).toBe("Olá Maria, novidade da Urolaser!");
  });
});

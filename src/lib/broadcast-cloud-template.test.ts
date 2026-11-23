import { describe, it, expect } from "vitest";
import { buildTemplateParams, cloudBroadcastMode, renderTemplatePreview, checkTemplateParamSources } from "./broadcast-cloud-template";
import { pickCloudTemplate, parseCloudTemplateVariants, checkCloudTemplateVariants } from "./broadcast-cloud-template";

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

describe("sorteio entre modelos aprovados", () => {
  const main = { name: "novembro_azul_convite", language: "pt_BR", body: "Olá, {{1}}! A" };
  const b = { name: "novembro_azul_direto", language: "pt_BR", body: "Oi, {{1}}! B" };
  const c = { name: "novembro_azul_voce_sabia", language: "pt_BR", body: "Olá, {{1}}! C" };

  it("sem variações, todo mundo recebe o principal", () => {
    expect(pickCloudTemplate(main, [], "abc")).toEqual({ index: 0, template: main });
  });
  it("escolha fixa por destinatário e espalhada entre os modelos", () => {
    const ids = Array.from({ length: 300 }, (_, i) => `cl${i}xyz`);
    const picks = ids.map((id) => pickCloudTemplate(main, [b, c], id));
    expect(pickCloudTemplate(main, [b, c], ids[7])).toEqual(picks[7]);
    const counts = [0, 1, 2].map((i) => picks.filter((p) => p.index === i).length);
    for (const n of counts) expect(n).toBeGreaterThan(60);
    for (const p of picks) expect(p.template).toBe([main, b, c][p.index]);
  });
  it("lê a lista guardada no banco e ignora lixo", () => {
    expect(parseCloudTemplateVariants([b, { name: "" }, null, "x", { name: "y" }])).toEqual([b, { name: "y", language: "pt_BR", body: "" }]);
    expect(parseCloudTemplateVariants(null)).toEqual([]);
  });
  it("confere as variações: até 2, sem repetir, mesmos campos do principal", () => {
    const m = { name: "a", variableCount: 1 };
    expect(checkCloudTemplateVariants(m, [])).toBeNull();
    expect(checkCloudTemplateVariants(m, [{ name: "b", variableCount: 1 }, { name: "c", variableCount: 1 }])).toBeNull();
    expect(checkCloudTemplateVariants(m, [{ name: "b", variableCount: 1 }, { name: "c", variableCount: 1 }, { name: "d", variableCount: 1 }])).toMatch(/3 modelos/);
    expect(checkCloudTemplateVariants(m, [{ name: "a", variableCount: 1 }])).toMatch(/repetido/);
    expect(checkCloudTemplateVariants(m, [{ name: "b", variableCount: 2 }])).toMatch(/campos/);
  });
});

import { templateHasImageHeader, checkTemplateHeaderImage } from "./broadcast-cloud-template";

describe("modelo com foto no cabeçalho", () => {
  it("detecta cabeçalho IMAGE nos components da Meta", () => {
    expect(templateHasImageHeader([{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Oi" }])).toBe(true);
    expect(templateHasImageHeader([{ type: "HEADER", format: "TEXT", text: "Oi" }, { type: "BODY", text: "Oi" }])).toBe(false);
    expect(templateHasImageHeader([{ type: "BODY", text: "Oi" }])).toBe(false);
    expect(templateHasImageHeader(undefined)).toBe(false);
  });

  it("modelo com foto exige imagem JPG ou PNG anexada", () => {
    expect(checkTemplateHeaderImage(true, null)).toMatch(/foto/i);
    expect(checkTemplateHeaderImage(true, "application/pdf")).toMatch(/JPG ou PNG/);
    expect(checkTemplateHeaderImage(true, "image/webp")).toMatch(/JPG ou PNG/);
    expect(checkTemplateHeaderImage(true, "image/jpeg")).toBeNull();
    expect(checkTemplateHeaderImage(true, "image/png")).toBeNull();
  });

  it("modelo sem foto não aceita anexo (a Meta recusaria)", () => {
    expect(checkTemplateHeaderImage(false, null)).toBeNull();
    expect(checkTemplateHeaderImage(false, "image/jpeg")).toMatch(/não tem foto/i);
  });

  it("no sorteio, todos os modelos precisam ter (ou não ter) foto", () => {
    const main = { name: "a", variableCount: 1, headerImage: true };
    expect(checkCloudTemplateVariants(main, [{ name: "b", variableCount: 1, headerImage: true }])).toBeNull();
    expect(checkCloudTemplateVariants(main, [{ name: "b", variableCount: 1, headerImage: false }])).toMatch(/foto/i);
  });
});

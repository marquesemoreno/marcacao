import { describe, expect, it } from "vitest";
import { buildTemplateComponents } from "./cloud-template-components";

describe("buildTemplateComponents", () => {
  it("só o texto, com exemplos das variáveis (como antes)", () => {
    const r = buildTemplateComponents({ body: "Olá, {{1}}!", examples: ["Carlos"] });
    expect(r).toEqual({ ok: true, components: [{ type: "BODY", text: "Olá, {{1}}!", example: { body_text: [["Carlos"]] } }] });
  });

  it("texto sem variável não manda example", () => {
    const r = buildTemplateComponents({ body: "Bom dia!", examples: [] });
    expect(r).toEqual({ ok: true, components: [{ type: "BODY", text: "Bom dia!" }] });
  });

  it("acrescenta rodapé e botões de resposta rápida na ordem da Meta", () => {
    const r = buildTemplateComponents({
      body: "Oi, {{1}}",
      examples: ["Carlos"],
      footer: "  Digite 9 para não receber mais avisos.  ",
      buttons: ["Quero agendar", " Parar ", ""],
    });
    expect(r).toEqual({
      ok: true,
      components: [
        { type: "BODY", text: "Oi, {{1}}", example: { body_text: [["Carlos"]] } },
        { type: "FOOTER", text: "Digite 9 para não receber mais avisos." },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Quero agendar" },
            { type: "QUICK_REPLY", text: "Parar" },
          ],
        },
      ],
    });
  });

  it("rodapé vazio e botões vazios são ignorados", () => {
    const r = buildTemplateComponents({ body: "Oi", examples: [], footer: "   ", buttons: ["", "  "] });
    expect(r).toEqual({ ok: true, components: [{ type: "BODY", text: "Oi" }] });
  });

  it("recusa rodapé com mais de 60 caracteres", () => {
    const r = buildTemplateComponents({ body: "Oi", examples: [], footer: "x".repeat(61) });
    expect(r.ok).toBe(false);
  });

  it("recusa variável no rodapé", () => {
    const r = buildTemplateComponents({ body: "Oi", examples: [], footer: "Tchau {{1}}" });
    expect(r.ok).toBe(false);
  });

  it("recusa botão com mais de 25 caracteres", () => {
    const r = buildTemplateComponents({ body: "Oi", examples: [], buttons: ["x".repeat(26)] });
    expect(r.ok).toBe(false);
  });

  it("recusa botões repetidos", () => {
    const r = buildTemplateComponents({ body: "Oi", examples: [], buttons: ["Parar", "parar"] });
    expect(r.ok).toBe(false);
  });

  it("recusa mais de 3 botões (o formulário só oferece 3)", () => {
    const r = buildTemplateComponents({ body: "Oi", examples: [], buttons: ["a", "b", "c", "d"] });
    expect(r.ok).toBe(false);
  });

  it("recusa texto vazio e texto com mais de 1024 caracteres", () => {
    expect(buildTemplateComponents({ body: "  ", examples: [] }).ok).toBe(false);
    expect(buildTemplateComponents({ body: "x".repeat(1025), examples: [] }).ok).toBe(false);
  });

  it("recusa variável sem exemplo", () => {
    const r = buildTemplateComponents({ body: "Oi {{1}} e {{2}}", examples: ["Carlos", " "] });
    expect(r.ok).toBe(false);
  });
});

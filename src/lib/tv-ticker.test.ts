import { describe, expect, it } from "vitest";
import { buildTickerItems, isSafeHeadline, normalizeNotices, parseRssTitles, tickerDurationSec } from "./tv-ticker";

describe("letreiro da TV", () => {
  it("lê os títulos do RSS (com CDATA e entidades), sem o título do canal", () => {
    const xml = `<rss><channel><title>Feed Editoria</title><item><title>Anvisa recolhe lote &amp; alerta</title></item>
      <item><title><![CDATA[Vacina da gripe: campanha começa segunda]]></title></item><item><title>  </title></item></channel></rss>`;
    expect(parseRssTitles(xml)).toEqual(["Anvisa recolhe lote & alerta", "Vacina da gripe: campanha começa segunda"]);
  });

  it("tira manchete de morte e violência (sala de espera)", () => {
    expect(isSafeHeadline("Criança de 3 anos é morta a tiros dentro de casa")).toBe(false);
    expect(isSafeHeadline("Surto deixa 4 mortos no interior")).toBe(false);
    expect(isSafeHeadline("Homem morre após acidente")).toBe(false);
    expect(isSafeHeadline("Ministério amplia vacinação contra HPV")).toBe(true);
  });

  it("avisos da clínica: um por linha, sem vazios, até 10 e 160 caracteres", () => {
    const n = normalizeNotices(" Feriado dia 15: não abriremos \n\n" + "x".repeat(200) + "\n" + Array.from({ length: 12 }, (_, i) => `a${i}`).join("\n"));
    expect(n[0]).toBe("Feriado dia 15: não abriremos");
    expect(n[1]).toHaveLength(160);
    expect(n).toHaveLength(10);
  });

  it("avisos da clínica vêm primeiro; notícias com a fonte; total limitado", () => {
    const items = buildTickerItems(["Aviso A"], ["N1", "N2", "N3"], { max: 3 });
    expect(items).toEqual([
      { text: "Aviso A", source: null },
      { text: "N1", source: "Agência Brasil" },
      { text: "N2", source: "Agência Brasil" },
    ]);
  });

  it("velocidade de leitura: cresce com o tamanho, com piso", () => {
    expect(tickerDurationSec(10)).toBe(20);
    expect(tickerDurationSec(400)).toBeGreaterThan(tickerDurationSec(200));
  });
});

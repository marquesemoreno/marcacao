import { describe, it, expect } from "vitest";
import { parseBroadcastCsv, buildBroadcastMessage, BROADCAST_OPT_OUT_FOOTER } from "./broadcast-csv";

describe("parseBroadcastCsv", () => {
  it("aceita o CSV real relatado pelo usuário: sem cabeçalho, separado por ; (telefone,nome,procedimento)", () => {
    const csv = [
      "77999311841;Lucas Marques;Consulta Urológica",
      "77988411342;Sthefane Nogueira;Consulta Urológica",
      "77998276479;Davi Lucas;Consulta Urológica",
    ].join("\n");

    const result = parseBroadcastCsv(csv);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      phone: "77999311841",
      variables: { nome: "Lucas Marques", procedimento: "Consulta Urológica" },
    });
    expect(result[1].phone).toBe("77988411342");
    expect(result[1].variables.nome).toBe("Sthefane Nogueira");
  });

  it("continua aceitando o formato original: cabeçalho explícito, separado por vírgula", () => {
    const csv = ["telefone,nome,procedimento", "77999998888,Maria Silva,Consulta"].join("\n");

    const result = parseBroadcastCsv(csv);

    expect(result).toEqual([
      { phone: "77999998888", variables: { nome: "Maria Silva", procedimento: "Consulta" } },
    ]);
  });

  it("aceita cabeçalho explícito separado por ponto-e-vírgula, em qualquer ordem de colunas", () => {
    const csv = ["nome;telefone;procedimento", "Maria Silva;77999998888;Consulta"].join("\n");

    const result = parseBroadcastCsv(csv);

    expect(result).toEqual([
      { phone: "77999998888", variables: { nome: "Maria Silva", procedimento: "Consulta" } },
    ]);
  });

  it("retorna lista vazia pra CSV vazio", () => {
    expect(parseBroadcastCsv("")).toEqual([]);
    expect(parseBroadcastCsv("   ")).toEqual([]);
  });
});

describe("buildBroadcastMessage", () => {
  it("acrescenta o rodapé de opt-out numa mensagem simples", () => {
    const result = buildBroadcastMessage("Olá, tudo bem?", {});

    expect(result).toBe(`Olá, tudo bem?\n\n${BROADCAST_OPT_OUT_FOOTER}`);
  });

  it("aplica as variáveis do CSV antes de acrescentar o rodapé", () => {
    const result = buildBroadcastMessage("Olá {{nome}}, sua {{procedimento}} está confirmada.", {
      nome: "Maria Silva",
      procedimento: "Consulta Urológica",
    });

    expect(result).toBe(
      `Olá Maria Silva, sua Consulta Urológica está confirmada.\n\n${BROADCAST_OPT_OUT_FOOTER}`
    );
  });

  it("não duplica o rodapé se o admin já escreveu ele no template", () => {
    const template = `Aviso importante.\n\n${BROADCAST_OPT_OUT_FOOTER}`;

    const result = buildBroadcastMessage(template, {});

    expect(result).toBe(template);
  });
});

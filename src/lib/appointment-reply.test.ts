import { describe, it, expect } from "vitest";
import { resolveStatusFromReply, isRescheduleReply, wasSentConfirmationPrompt } from "./appointment-reply";

describe("resolveStatusFromReply", () => {
  it("reconhece o número da opção", () => {
    expect(resolveStatusFromReply("1")).toBe("CONFIRMED");
    expect(resolveStatusFromReply("3")).toBe("CANCELLED");
  });

  it("reconhece variações de texto livre pra confirmar, não só o número 1", () => {
    // Bug real: paciente respondia "Confirmado" em vez de "1" e a confirmação era ignorada.
    expect(resolveStatusFromReply("Confirmado")).toBe("CONFIRMED");
    expect(resolveStatusFromReply("confirmado!")).toBe("CONFIRMED");
    expect(resolveStatusFromReply("Confirmada")).toBe("CONFIRMED");
    expect(resolveStatusFromReply("CONFIRMO")).toBe("CONFIRMED");
    expect(resolveStatusFromReply("confirmar")).toBe("CONFIRMED");
    expect(resolveStatusFromReply("Sim")).toBe("CONFIRMED");
    expect(resolveStatusFromReply("sim, confirmo")).toBe("CONFIRMED");
    expect(resolveStatusFromReply("ok")).toBe("CONFIRMED");
    expect(resolveStatusFromReply("Ok!")).toBe("CONFIRMED");
  });

  it("reconhece variações de texto livre pra cancelar", () => {
    expect(resolveStatusFromReply("Cancelado")).toBe("CANCELLED");
    expect(resolveStatusFromReply("cancelar")).toBe("CANCELLED");
    expect(resolveStatusFromReply("Não")).toBe("CANCELLED");
    expect(resolveStatusFromReply("nao")).toBe("CANCELLED");
    expect(resolveStatusFromReply("Não.")).toBe("CANCELLED");
  });

  it("não confunde uma frase qualquer que contenha 'não' no meio com um cancelamento", () => {
    // Ex: paciente tirando dúvida, não respondendo à confirmação — casar só a palavra
    // "não" dentro de uma frase mais longa daria falso positivo de cancelamento.
    expect(resolveStatusFromReply("Não sei se consigo ir amanhã, posso remarcar depois?")).toBeNull();
  });

  it("ignora mensagens que não são nem confirmação nem cancelamento", () => {
    expect(resolveStatusFromReply("Bom dia")).toBeNull();
    expect(resolveStatusFromReply("Qual o endereço?")).toBeNull();
  });
});

describe("isRescheduleReply", () => {
  it("reconhece o número da opção e variações de texto livre", () => {
    expect(isRescheduleReply("2")).toBe(true);
    expect(isRescheduleReply("Remarcar")).toBe(true);
    expect(isRescheduleReply("reagendar")).toBe(true);
    expect(isRescheduleReply("Quero remarcar")).toBe(false); // frase mais longa, não é o texto exato da opção
  });

  it("ignora mensagens não relacionadas", () => {
    expect(isRescheduleReply("Bom dia")).toBe(false);
  });
});

describe("wasSentConfirmationPrompt", () => {
  it("reconhece as 3 variações de template que pedem confirmação", () => {
    expect(
      wasSentConfirmationPrompt(
        "Olá João! Lembrando da sua consulta amanhã às 10h. Por favor, responda com o número da opção desejada:\n1️⃣ Digite 1 para Confirmar presença\n2️⃣ Digite 2 para Remarcar\n3️⃣ Digite 3 para Cancelar"
      )
    ).toBe(true);
  });

  it("bloqueia quando a última mensagem nossa não foi um pedido de confirmação", () => {
    // Bug real: paciente respondia "Sim" pra uma pergunta qualquer da atendente
    // ("seria biópsia de próstata, correto?") e o sistema tratava como confirmação
    // de agendamento, disparando a mensagem automática no meio da conversa manual.
    expect(wasSentConfirmationPrompt("Seria uma Biópsia de próstata, correto?")).toBe(false);
    expect(wasSentConfirmationPrompt("Olá boa tarde! Tudo bem?")).toBe(false);
  });

  it("trata ausência de mensagem anterior como não-confirmação", () => {
    expect(wasSentConfirmationPrompt(null)).toBe(false);
    expect(wasSentConfirmationPrompt(undefined)).toBe(false);
  });
});

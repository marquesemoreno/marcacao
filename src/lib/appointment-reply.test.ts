import { describe, it, expect } from "vitest";
import { resolveStatusFromReply, isRescheduleReply } from "./appointment-reply";

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

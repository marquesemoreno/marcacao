import { describe, expect, it } from "vitest";
import { addressReply, isAddressQuestion, renderWelcome, shouldSendAddressReply, shouldSendWelcome } from "./welcome-message";

const now = new Date("2026-11-09T12:00:00Z"); // 09:00 em Brasília

describe("shouldSendWelcome", () => {
  const base = { enabled: true, text: "{{saudacao}}! Em que posso ajudar?", isNewConversation: false, previousStatus: "RESOLVED", previousLastMessageAt: new Date("2026-11-08T12:00:00Z"), now };

  it("primeiro contato sempre recebe", () => {
    expect(shouldSendWelcome({ ...base, isNewConversation: true, previousStatus: null, previousLastMessageAt: null })).toBe(true);
  });
  it("volta depois de conversa finalizada há 6 h ou mais", () => {
    expect(shouldSendWelcome(base)).toBe(true);
  });
  it("não repete se a conversa finalizada é recente (< 6 h)", () => {
    expect(shouldSendWelcome({ ...base, previousLastMessageAt: new Date("2026-11-09T09:00:00Z") })).toBe(false);
  });
  it("não cumprimenta no meio de um atendimento em aberto", () => {
    expect(shouldSendWelcome({ ...base, previousStatus: "OPEN" })).toBe(false);
  });
  it("desligada ou sem texto não envia", () => {
    expect(shouldSendWelcome({ ...base, enabled: false })).toBe(false);
    expect(shouldSendWelcome({ ...base, text: " " })).toBe(false);
  });
});

describe("renderWelcome", () => {
  it("troca {{saudacao}} pelo período em Brasília e {{nome}} pelo primeiro nome", () => {
    expect(renderWelcome("{{saudacao}}, {{nome}}!", { name: "MARIA DA SILVA", now })).toBe("Bom dia, Maria!");
    expect(renderWelcome("{{saudacao}}", { name: "x", now: new Date("2026-11-09T17:00:00Z") })).toBe("Boa tarde");
    expect(renderWelcome("{{saudacao}}", { name: "x", now: new Date("2026-11-09T23:30:00Z") })).toBe("Boa noite");
    expect(renderWelcome("{{saudacao}}", { name: "x", now: new Date("2026-11-09T04:00:00Z") })).toBe("Boa noite");
  });
  it("sem nome útil (número) some com o nome e a vírgula", () => {
    expect(renderWelcome("{{saudacao}}, {{nome}}! Tudo bem?", { name: "5577999311841", now })).toBe("Bom dia! Tudo bem?");
  });
});

describe("isAddressQuestion", () => {
  it.each(["Onde fica a clínica?", "qual o endereço?", "Vcs ficam onde?", "como faço pra chegar aí", "me manda a localização", "qual a rua de vocês", "endereco por favor"])(
    "reconhece: %s",
    (t) => expect(isAddressQuestion(t)).toBe(true)
  );
  it.each(["Quero marcar uma consulta", "onde pego o resultado do exame?", "ok obrigada", "Moro longe, vocês atendem domingo?", "Endereço: Rua Centenário n 420", "Nota fiscal nesse endereço", "Doutor: Data: Horário: Valor: Endereço Chave pix:", "Olá URO LASER! Eu sou a Elô, assistente virtual da Cielo! Recebemos a sua solicitação de TROCA DE TECNOLOGIA do seu equipamento e precisamos confirmar o endereço de entrega"])("ignora: %s", (t) =>
    expect(isAddressQuestion(t)).toBe(false)
  );
});

describe("addressReply / shouldSendAddressReply", () => {
  it("monta endereço com link do Google Maps", () => {
    const r = addressReply({ address: "Av. Otávio Santos, 237", neighborhood: "Recreio", city: "Vitória da Conquista" });
    expect(r).toContain("Av. Otávio Santos, 237 - Recreio, Vitória da Conquista");
    expect(r).toContain("https://www.google.com/maps/search/?api=1&query=Av.%20Ot%C3%A1vio%20Santos%2C%20237%2C%20Recreio%2C%20Vit%C3%B3ria%20da%20Conquista");
  });
  it("não repete em 12 h na mesma conversa", () => {
    const base = { enabled: true, message: "onde fica?", now };
    expect(shouldSendAddressReply({ ...base, lastAddressReplyAt: null })).toBe(true);
    expect(shouldSendAddressReply({ ...base, lastAddressReplyAt: new Date("2026-11-09T05:00:00Z") })).toBe(false);
    expect(shouldSendAddressReply({ ...base, lastAddressReplyAt: new Date("2026-11-08T20:00:00Z") })).toBe(true);
    expect(shouldSendAddressReply({ ...base, enabled: false, lastAddressReplyAt: null })).toBe(false);
  });
});

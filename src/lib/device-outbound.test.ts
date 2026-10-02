import { describe, it, expect } from "vitest";
import { deviceOutboundTargetPhone, findPanelTwin } from "./device-outbound";

describe("deviceOutboundTargetPhone", () => {
  it("telefone do paciente a partir do remoteJid", () => {
    expect(deviceOutboundTargetPhone({ remoteJid: "5577991234567@s.whatsapp.net" })).toBe("5577991234567");
  });
  it("@lid usa o remoteJidAlt/senderPn quando vier, senão não tem como saber o telefone", () => {
    expect(deviceOutboundTargetPhone({ remoteJid: "123456789012345@lid", remoteJidAlt: "5577991234567@s.whatsapp.net" })).toBe(
      "5577991234567"
    );
    expect(deviceOutboundTargetPhone({ remoteJid: "123456789012345@lid" })).toBeNull();
  });
  it("ignora grupo, status e broadcast", () => {
    expect(deviceOutboundTargetPhone({ remoteJid: "120363000000000000@g.us" })).toBeNull();
    expect(deviceOutboundTargetPhone({ remoteJid: "status@broadcast" })).toBeNull();
    expect(deviceOutboundTargetPhone({})).toBeNull();
  });
});

describe("findPanelTwin", () => {
  const at = new Date("2026-10-02T12:00:00Z");
  const msg = (id: string, content: string, secondsBefore: number, whatsappKeyId: string | null = null) => ({
    id,
    content,
    whatsappKeyId,
    createdAt: new Date(at.getTime() - secondsBefore * 1000),
  });

  it("acha a mensagem do painel ainda sem keyId, mesmo texto, nos últimos 2 min", () => {
    expect(findPanelTwin([msg("a", "Olá, tudo bem?", 30)], { content: "Olá, tudo bem?", at })?.id).toBe("a");
  });
  it("compara ignorando espaços nas pontas", () => {
    expect(findPanelTwin([msg("a", "Olá ", 5)], { content: " Olá", at })?.id).toBe("a");
  });
  it("não casa texto diferente, mensagem antiga ou que já tem keyId", () => {
    expect(findPanelTwin([msg("a", "Oi", 30)], { content: "Olá", at })).toBeNull();
    expect(findPanelTwin([msg("a", "Olá", 300)], { content: "Olá", at })).toBeNull();
    expect(findPanelTwin([msg("a", "Olá", 10, "KEY")], { content: "Olá", at })).toBeNull();
  });
  it("com várias iguais, pega a mais próxima no tempo", () => {
    expect(findPanelTwin([msg("a", "Ok", 90), msg("b", "Ok", 3)], { content: "Ok", at })?.id).toBe("b");
  });
});

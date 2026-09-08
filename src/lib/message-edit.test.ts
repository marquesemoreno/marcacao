import { describe, it, expect } from "vitest";
import { canEditMessage, EDIT_WINDOW_MINUTES } from "./message-edit";

const baseMessage = {
  type: "TEXT" as const,
  direction: "OUTBOUND" as const,
  whatsappKeyId: "3EB0ABC123",
  createdAt: new Date("2026-01-01T10:00:00Z"),
  deletedAt: null as Date | null,
};

describe("canEditMessage", () => {
  it("permite editar uma mensagem de texto nossa, recente e confirmada como enviada", () => {
    const now = new Date("2026-01-01T10:05:00Z");
    expect(canEditMessage(baseMessage, now)).toEqual({ ok: true });
  });

  it("bloqueia mensagem do paciente (INBOUND)", () => {
    const now = new Date("2026-01-01T10:05:00Z");
    expect(canEditMessage({ ...baseMessage, direction: "INBOUND" }, now).ok).toBe(false);
  });

  it("bloqueia tipos que não são texto (áudio, anexo, nota interna)", () => {
    const now = new Date("2026-01-01T10:05:00Z");
    expect(canEditMessage({ ...baseMessage, type: "AUDIO" }, now).ok).toBe(false);
    expect(canEditMessage({ ...baseMessage, type: "ATTACHMENT" }, now).ok).toBe(false);
    expect(canEditMessage({ ...baseMessage, type: "INTERNAL_NOTE" }, now).ok).toBe(false);
  });

  it("bloqueia mensagem apagada", () => {
    const now = new Date("2026-01-01T10:05:00Z");
    expect(canEditMessage({ ...baseMessage, deletedAt: new Date("2026-01-01T10:01:00Z") }, now).ok).toBe(false);
  });

  it("bloqueia mensagem que ainda não confirmou envio (sem whatsappKeyId, ex: falhou)", () => {
    const now = new Date("2026-01-01T10:05:00Z");
    expect(canEditMessage({ ...baseMessage, whatsappKeyId: null }, now).ok).toBe(false);
  });

  it("bloqueia mensagem mais velha que a janela de edição do WhatsApp", () => {
    // Bug real evitado: mandar edição pra fora da janela não dá erro visível no
    // WhatsApp (a Meta só ignora silenciosamente) — melhor nem deixar tentar.
    const now = new Date(baseMessage.createdAt.getTime() + (EDIT_WINDOW_MINUTES + 1) * 60000);
    expect(canEditMessage(baseMessage, now).ok).toBe(false);
  });

  it("permite editar bem no limite da janela", () => {
    const now = new Date(baseMessage.createdAt.getTime() + (EDIT_WINDOW_MINUTES - 1) * 60000);
    expect(canEditMessage(baseMessage, now).ok).toBe(true);
  });
});

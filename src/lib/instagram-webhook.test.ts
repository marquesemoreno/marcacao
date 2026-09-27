import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyMetaSignature,
  parseInstagramWebhook,
  messagingWindowState,
} from "./instagram-webhook";

const ACCOUNT = "17841400000000000";
const USER = "998877665544";

const wrap = (messaging: unknown[]) => ({ object: "instagram", entry: [{ id: ACCOUNT, time: 1, messaging }] });

describe("verifyMetaSignature", () => {
  const secret = "app-secret";
  const body = '{"object":"instagram"}';
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("aceita assinatura correta", () => {
    expect(verifyMetaSignature(body, sig, secret)).toBe(true);
  });
  it("rejeita assinatura errada, ausente ou sem segredo configurado", () => {
    expect(verifyMetaSignature(body, "sha256=" + "0".repeat(64), secret)).toBe(false);
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
    expect(verifyMetaSignature(body, sig, undefined)).toBe(false);
    expect(verifyMetaSignature(body, "lixo", secret)).toBe(false);
  });
});

describe("parseInstagramWebhook", () => {
  it("mensagem de texto recebida", () => {
    const events = parseInstagramWebhook(
      wrap([{ sender: { id: USER }, recipient: { id: ACCOUNT }, timestamp: 1759000000000, message: { mid: "m1", text: "Oi, quero agendar" } }])
    );
    expect(events).toEqual([
      {
        kind: "message",
        accountId: ACCOUNT,
        userId: USER,
        fromMe: false,
        mid: "m1",
        text: "Oi, quero agendar",
        attachments: [],
        timestamp: new Date(1759000000000),
      },
    ]);
  });

  it("echo (resposta enviada pelo app do Instagram) vira fromMe e o usuário é o recipient", () => {
    const [e] = parseInstagramWebhook(
      wrap([{ sender: { id: ACCOUNT }, recipient: { id: USER }, timestamp: 1, message: { mid: "m2", text: "Olá!", is_echo: true } }])
    );
    expect(e).toMatchObject({ kind: "message", fromMe: true, userId: USER });
  });

  it("imagem, áudio e story mention", () => {
    const [e] = parseInstagramWebhook(
      wrap([
        {
          sender: { id: USER },
          recipient: { id: ACCOUNT },
          timestamp: 1,
          message: {
            mid: "m3",
            attachments: [
              { type: "image", payload: { url: "https://cdn/img.jpg" } },
              { type: "audio", payload: { url: "https://cdn/a.mp4" } },
              { type: "story_mention", payload: { url: "https://cdn/story.mp4" } },
            ],
          },
        },
      ])
    );
    expect(e).toMatchObject({
      text: null,
      attachments: [
        { type: "image", url: "https://cdn/img.jpg" },
        { type: "audio", url: "https://cdn/a.mp4" },
        { type: "story_mention", url: "https://cdn/story.mp4" },
      ],
    });
  });

  it("leitura e mensagem apagada", () => {
    const events = parseInstagramWebhook(
      wrap([
        { sender: { id: USER }, recipient: { id: ACCOUNT }, timestamp: 1, read: { mid: "m9" } },
        { sender: { id: USER }, recipient: { id: ACCOUNT }, timestamp: 1, message: { mid: "m8", is_deleted: true } },
      ])
    );
    expect(events).toEqual([
      { kind: "read", accountId: ACCOUNT, userId: USER, mid: "m9" },
      { kind: "deleted", accountId: ACCOUNT, mid: "m8" },
    ]);
  });

  it("ignora payload de outro objeto ou malformado", () => {
    expect(parseInstagramWebhook({ object: "page", entry: [] })).toEqual([]);
    expect(parseInstagramWebhook(null)).toEqual([]);
    expect(parseInstagramWebhook(wrap([{ sender: {}, recipient: {} }]))).toEqual([]);
  });
});

describe("messagingWindowState", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  it("dentro de 24h, entre 24h e 7 dias (HUMAN_AGENT) e fechada", () => {
    expect(messagingWindowState(new Date("2026-09-28T01:00:00Z"), now)).toBe("OPEN");
    expect(messagingWindowState(new Date("2026-09-25T12:00:00Z"), now)).toBe("HUMAN_AGENT");
    expect(messagingWindowState(new Date("2026-09-20T12:00:00Z"), now)).toBe("CLOSED");
    expect(messagingWindowState(null, now)).toBe("CLOSED");
  });
});

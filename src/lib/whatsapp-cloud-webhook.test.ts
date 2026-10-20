import { describe, expect, it } from "vitest";
import { parseCloudWebhook, toEvolutionPayload } from "./whatsapp-cloud-webhook";

const entry = (field: string, value: object) => ({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field, value }] }] });

describe("parseCloudWebhook", () => {
  it("mensagem de texto recebida do paciente", () => {
    const events = parseCloudWebhook(
      entry("messages", {
        metadata: { phone_number_id: "PN1", display_phone_number: "5577999708403" },
        contacts: [{ wa_id: "5577988887777", profile: { name: "Maria" } }],
        messages: [{ id: "wamid.A", from: "5577988887777", timestamp: "1791300000", type: "text", text: { body: "Oi" } }],
      })
    );
    expect(events).toEqual([
      { kind: "inbound", phoneNumberId: "PN1", from: "5577988887777", name: "Maria", keyId: "wamid.A", text: "Oi", type: "text", at: new Date(1791300000 * 1000) },
    ]);
  });

  it("mensagem mandada pelo app do celular (coexistência) vira saída do aparelho", () => {
    const events = parseCloudWebhook(
      entry("smb_message_echoes", {
        metadata: { phone_number_id: "PN1" },
        message_echoes: [{ id: "wamid.B", from: "5577999708403", to: "5577988887777", timestamp: "1791300100", type: "text", text: { body: "Olá!" } }],
      })
    );
    expect(events).toEqual([
      { kind: "device_outbound", phoneNumberId: "PN1", to: "5577988887777", keyId: "wamid.B", text: "Olá!", type: "text", at: new Date(1791300100 * 1000) },
    ]);
  });

  it("status de entrega/leitura", () => {
    const events = parseCloudWebhook(
      entry("messages", { metadata: { phone_number_id: "PN1" }, statuses: [{ id: "wamid.C", status: "read", timestamp: "1791300200", recipient_id: "5577988887777" }] })
    );
    expect(events).toEqual([{ kind: "status", phoneNumberId: "PN1", keyId: "wamid.C", status: "read", at: new Date(1791300200 * 1000) }]);
  });

  it("mídia vira marcador com o id da mídia; payload estranho é ignorado", () => {
    const events = parseCloudWebhook(
      entry("messages", {
        metadata: { phone_number_id: "PN1" },
        messages: [{ id: "wamid.D", from: "5577988887777", timestamp: "1791300300", type: "image", image: { id: "MEDIA1", mime_type: "image/jpeg", caption: "exame" } }],
      })
    );
    expect(events[0]).toMatchObject({ kind: "inbound", type: "image", text: "exame", mediaId: "MEDIA1", mimeType: "image/jpeg" });
    expect(parseCloudWebhook({ object: "page" })).toEqual([]);
    expect(parseCloudWebhook(null)).toEqual([]);
  });
});

describe("toEvolutionPayload", () => {
  it("converte mensagem recebida para o formato messages.upsert da Evolution", () => {
    const p = toEvolutionPayload("clinic1", {
      kind: "inbound",
      phoneNumberId: "1",
      from: "5577999998888",
      name: "Maria",
      keyId: "wamid.X",
      text: "1",
      type: "text",
      at: new Date("2026-10-21T12:00:00Z"),
    });
    expect(p).toEqual({
      event: "messages.upsert",
      instance: "cloud-api",
      data: {
        key: { remoteJid: "5577999998888@s.whatsapp.net", fromMe: false, id: "wamid.X" },
        pushName: "Maria",
        message: { conversation: "1" },
        messageTimestamp: 1792584000,
      },
    });
  });
});

describe("toEvolutionPayload com mídia", () => {
  const base = { kind: "inbound" as const, phoneNumberId: "1", from: "5577999998888", keyId: "wamid.M", at: new Date("2026-10-21T12:00:00Z") };
  it("imagem vira imageMessage com o id da mídia e a clínica na key", () => {
    const p = toEvolutionPayload("clinic1", { ...base, type: "image", text: "olha o exame", mediaId: "MID", mimeType: "image/jpeg" });
    expect(p.data.key).toEqual({ remoteJid: "5577999998888@s.whatsapp.net", fromMe: false, id: "wamid.M", cloudMediaId: "MID", cloudClinicId: "clinic1" });
    expect(p.data.message).toEqual({ imageMessage: { mimetype: "image/jpeg", caption: "olha o exame" } });
  });
  it("áudio vira audioMessage; documento e vídeo viram documentMessage", () => {
    expect(toEvolutionPayload("c", { ...base, type: "audio", text: "🎤 Áudio recebido", mediaId: "A", mimeType: "audio/ogg" }).data.message).toEqual({
      audioMessage: { mimetype: "audio/ogg", seconds: 0 },
    });
    expect(toEvolutionPayload("c", { ...base, type: "document", text: "📄 Documento recebido", mediaId: "D", mimeType: "application/pdf" }).data.message).toEqual({
      documentMessage: { mimetype: "application/pdf", fileName: "documento.pdf" },
    });
    expect(toEvolutionPayload("c", { ...base, type: "video", text: "🎬 Vídeo recebido", mediaId: "V", mimeType: "video/mp4" }).data.message).toEqual({
      documentMessage: { mimetype: "video/mp4", fileName: "video.mp4" },
    });
  });
});

describe("nome original do documento", () => {
  it("parseCloudWebhook guarda o filename e toEvolutionPayload usa no documentMessage", () => {
    const body = {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: {
        metadata: { phone_number_id: "1" },
        contacts: [{ wa_id: "5577999998888", profile: { name: "Ana" } }],
        messages: [{ from: "5577999998888", id: "wamid.D", timestamp: "1792584000", type: "document",
          document: { id: "DOC1", mime_type: "application/pdf", filename: "pedido-exame.pdf" } }],
      } }] }],
    };
    const [ev] = parseCloudWebhook(body);
    expect(ev).toMatchObject({ kind: "inbound", fileName: "pedido-exame.pdf", mediaId: "DOC1" });
    const p = toEvolutionPayload("c", ev as Extract<typeof ev, { kind: "inbound" }>);
    expect(p.data.message).toEqual({ documentMessage: { mimetype: "application/pdf", fileName: "pedido-exame.pdf" } });
  });
});

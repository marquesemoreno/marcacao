import { describe, expect, it } from "vitest";
import { parseCloudWebhook } from "./whatsapp-cloud-webhook";

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

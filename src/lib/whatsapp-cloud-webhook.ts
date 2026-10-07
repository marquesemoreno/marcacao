/* eslint-disable @typescript-eslint/no-explicit-any -- payload da Meta sem tipagem oficial; a saída é tipada (CloudEvent) */
/** Leitura do webhook da API oficial do WhatsApp (Cloud API) — formato da Meta para
 * eventos que hoje chegam pela Evolution: mensagem recebida, mensagem mandada pelo app do
 * celular (coexistência, `smb_message_echoes`) e status de entrega/leitura. Puro e
 * testado; quem identifica a clínica (pelo phone_number_id) e grava é a rota. */

type MediaFields = { mediaId?: string; mimeType?: string };

export type CloudEvent =
  | ({ kind: "inbound"; phoneNumberId: string; from: string; name?: string; keyId: string; text: string; type: string; at: Date } & MediaFields)
  | ({ kind: "device_outbound"; phoneNumberId: string; to: string; keyId: string; text: string; type: string; at: Date } & MediaFields)
  | { kind: "status"; phoneNumberId: string; keyId: string; status: string; at: Date };

const MEDIA_LABEL: Record<string, string> = {
  image: "📷 Imagem",
  video: "🎬 Vídeo",
  audio: "🎤 Áudio",
  document: "📄 Documento",
  sticker: "Figurinha",
};

type RawMsg = Record<string, any>;

function readContent(m: RawMsg, direction: "recebid" | "enviad"): { text: string } & MediaFields {
  if (m.type === "text") return { text: m.text?.body ?? "" };
  if (m.type === "button") return { text: m.button?.text ?? "" };
  if (m.type === "interactive") return { text: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "" };
  const media = m[m.type];
  if (media && MEDIA_LABEL[m.type]) {
    const gender = m.type === "image" ? "a" : "o";
    return { text: media.caption || `${MEDIA_LABEL[m.type]} ${direction}${gender}`, mediaId: media.id, mimeType: media.mime_type };
  }
  return { text: `[${m.type ?? "mensagem"}]` };
}

const toDate = (ts: string | number | undefined) => new Date(Number(ts ?? 0) * 1000);

export function parseCloudWebhook(body: unknown): CloudEvent[] {
  const b = body as { object?: string; entry?: { changes?: { field?: string; value?: RawMsg }[] }[] } | null;
  if (!b || b.object !== "whatsapp_business_account" || !Array.isArray(b.entry)) return [];
  const events: CloudEvent[] = [];
  for (const entry of b.entry) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      const phoneNumberId: string | undefined = v.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      if (change.field === "messages") {
        const names = new Map<string, string>((v.contacts ?? []).map((c: RawMsg) => [c.wa_id, c.profile?.name]));
        for (const m of v.messages ?? []) {
          const name = names.get(m.from);
          events.push({
            kind: "inbound",
            phoneNumberId,
            from: m.from,
            ...(name ? { name } : {}),
            keyId: m.id,
            type: m.type,
            at: toDate(m.timestamp),
            ...readContent(m, "recebid"),
          });
        }
        for (const s of v.statuses ?? []) {
          events.push({ kind: "status", phoneNumberId, keyId: s.id, status: s.status, at: toDate(s.timestamp) });
        }
      } else if (change.field === "smb_message_echoes") {
        for (const m of v.message_echoes ?? []) {
          events.push({ kind: "device_outbound", phoneNumberId, to: m.to, keyId: m.id, type: m.type, at: toDate(m.timestamp), ...readContent(m, "enviad") });
        }
      }
    }
  }
  return events;
}

import "server-only";

/** Cliente da API oficial do WhatsApp (Cloud API, Graph). Enquanto a conta da clínica
 * estiver com `active: false`, nada aqui é chamado pelo Chat — só pela tela de admin e
 * pelos testes da análise do app. Env: META_APP_ID, META_APP_SECRET (troca do código do
 * Embedded Signup e assinatura do webhook). */

import { META_APP_ID, META_GRAPH_VERSION } from "@/lib/meta-config";
import { templateSendComponents } from "@/lib/cloud-template-components";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export type CloudResult<T = unknown> = { success: true; data: T } | { success: false; error: string; code?: number };

async function graph<T>(path: string, init: { method?: string; token: string; body?: unknown; query?: Record<string, string> }): Promise<CloudResult<T>> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${init.token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
    if (!res.ok || json.error) return { success: false, error: json.error?.message ?? `HTTP ${res.status}`, code: json.error?.code };
    return { success: true, data: json };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Texto livre — só vale dentro da janela de 24 h aberta pela última mensagem do paciente. */
export function sendCloudText(phoneNumberId: string, token: string, to: string, body: string) {
  return graph<{ messages?: { id: string }[] }>(`${phoneNumberId}/messages`, {
    token,
    body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } },
  });
}

/** Baixa mídia recebida: GET /{media-id} dá uma URL temporária, que também exige o token. */
export async function downloadCloudMedia(mediaId: string, token: string): Promise<CloudResult<{ base64: string; mimeType?: string }>> {
  const meta = await graph<{ url?: string; mime_type?: string }>(mediaId, { token });
  if (!meta.success) return meta;
  if (!meta.data.url) return { success: false, error: "Meta não devolveu a URL da mídia" };
  try {
    const res = await fetch(meta.data.url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) return { success: false, error: `HTTP ${res.status} ao baixar mídia` };
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { success: true, data: { base64, mimeType: meta.data.mime_type } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Cartão de contato (vCard) — dentro da janela de 24 h. */
export function sendCloudContact(phoneNumberId: string, token: string, to: string, contact: { name: string; phone: string }) {
  const first = contact.name.trim().split(/\s+/)[0] || contact.name;
  return graph<{ messages?: { id: string }[] }>(`${phoneNumberId}/messages`, {
    token,
    body: {
      messaging_product: "whatsapp",
      to,
      type: "contacts",
      contacts: [{ name: { formatted_name: contact.name, first_name: first }, phones: [{ phone: `+${contact.phone}`, type: "CELL", wa_id: contact.phone }] }],
    },
  });
}

/** Reação (emoji) numa mensagem pelo wamid; emoji "" remove a reação. */
export function sendCloudReaction(phoneNumberId: string, token: string, to: string, messageId: string, emoji: string) {
  return graph<{ messages?: { id: string }[] }>(`${phoneNumberId}/messages`, {
    token,
    body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: "reaction", reaction: { message_id: messageId, emoji } },
  });
}

/** Mídia por link público (URL assinada do storage) — dentro da janela de 24 h. */
export function sendCloudMedia(
  phoneNumberId: string,
  token: string,
  to: string,
  media: { kind: "image" | "video" | "audio" | "document"; link: string; caption?: string; filename?: string }
) {
  const payload: Record<string, string> = { link: media.link };
  if (media.caption && media.kind !== "audio") payload.caption = media.caption;
  if (media.filename && media.kind === "document") payload.filename = media.filename;
  return graph<{ messages?: { id: string }[] }>(`${phoneNumberId}/messages`, {
    token,
    body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: media.kind, [media.kind]: payload },
  });
}

/** Modelo aprovado — o único jeito de iniciar conversa (lembrete D-1 etc.). */
export function sendCloudTemplate(
  phoneNumberId: string,
  token: string,
  to: string,
  template: { name: string; language: string; bodyParams?: string[]; /** Modelo com foto no cabeçalho: link da imagem. */ headerImageLink?: string | null }
) {
  const components = templateSendComponents(template.bodyParams ?? [], template.headerImageLink);
  return graph<{ messages?: { id: string }[] }>(`${phoneNumberId}/messages`, {
    token,
    body: {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template.name, language: { code: template.language }, ...(components.length ? { components } : {}) },
    },
  });
}

/** Sobe a foto de exemplo de um modelo novo (Resumable Upload da Meta): abre a sessão no app e
 * envia os bytes; devolve o handle que vai em HEADER.example.header_handle. */
export async function uploadTemplateHeaderImage(
  token: string,
  file: { bytes: Buffer; mimeType: string; fileName: string }
): Promise<CloudResult<{ handle: string }>> {
  const session = await graph<{ id?: string }>(`${META_APP_ID}/uploads`, {
    method: "POST",
    token,
    query: { file_name: file.fileName, file_length: String(file.bytes.length), file_type: file.mimeType },
  });
  if (!session.success) return session;
  if (!session.data.id) return { success: false, error: "A Meta não abriu a sessão de upload da foto." };
  try {
    const res = await fetch(`${GRAPH}/${session.data.id}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${token}`, file_offset: "0", "Content-Type": file.mimeType },
      body: new Uint8Array(file.bytes),
      signal: AbortSignal.timeout(30000),
    });
    const json = (await res.json().catch(() => ({}))) as { h?: string; error?: { message?: string; code?: number } };
    if (!res.ok || !json.h) return { success: false, error: json.error?.message ?? `HTTP ${res.status} no upload da foto`, code: json.error?.code };
    return { success: true, data: { handle: json.h } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export type CloudTemplate = { id: string; name: string; status: string; category: string; language: string };

export function listCloudTemplates(wabaId: string, token: string) {
  return graph<{ data: CloudTemplate[] }>(`${wabaId}/message_templates`, { token, query: { fields: "id,name,status,category,language,components", limit: "100" } });
}

/** Cria modelo (vai pra análise da Meta). `components` vem de buildTemplateComponents
 * (texto com exemplos, rodapé e botões de resposta rápida, já conferidos). */
export function createCloudTemplate(
  wabaId: string,
  token: string,
  t: { name: string; category: "UTILITY" | "MARKETING"; language: string; components: unknown[] }
) {
  return graph<{ id: string; status: string; category: string }>(`${wabaId}/message_templates`, {
    token,
    body: { name: t.name, category: t.category, language: t.language, components: t.components },
  });
}

/** Embedded Signup: troca o código devolvido pelo popup por um token de integração do negócio. */
export async function exchangeEmbeddedSignupCode(code: string): Promise<CloudResult<{ access_token: string }>> {
  const appId = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!appId || !secret) return { success: false, error: "META_APP_ID/META_APP_SECRET não configurados" };
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", secret);
  url.searchParams.set("code", code);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const json = (await res.json()) as { access_token?: string; error?: { message?: string; code?: number } };
    if (!res.ok || !json.access_token) return { success: false, error: json.error?.message ?? `HTTP ${res.status}`, code: json.error?.code };
    return { success: true, data: { access_token: json.access_token } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Assina o webhook do app na WABA da clínica (sem isso, os eventos não chegam). */
export function subscribeAppToWaba(wabaId: string, token: string) {
  return graph<{ success: boolean }>(`${wabaId}/subscribed_apps`, { token, method: "POST" });
}

/** Número de exibição do phone_number_id (pra mostrar na tela de admin). */
export function getPhoneNumberInfo(phoneNumberId: string, token: string) {
  return graph<{ display_phone_number?: string; verified_name?: string }>(phoneNumberId, {
    token,
    query: { fields: "display_phone_number,verified_name" },
  });
}

/** Nível de mensagens da Meta (quantas pessoas a clínica pode chamar primeiro em 24 h) e
 * nota de qualidade. Base do teto das campanhas (cloudDailyCap). */
export function getMessagingLimit(phoneNumberId: string, token: string) {
  return graph<{ messaging_limit_tier?: string; quality_rating?: string }>(phoneNumberId, {
    token,
    query: { fields: "messaging_limit_tier,quality_rating" },
  });
}

/** Coexistência: pede à Meta pra sincronizar contatos e o histórico (últimos 6 meses) do app
 * WhatsApp Business. Precisa ser chamado em até 24 h depois da conexão — senão o número
 * tem que ser desconectado e conectado de novo. Cada tipo só pode rodar uma vez. */
export function requestCoexistenceSync(phoneNumberId: string, token: string, syncType: "smb_app_state_sync" | "history") {
  return graph<{ request_id?: string }>(`${phoneNumberId}/smb_app_data`, {
    token,
    body: { messaging_product: "whatsapp", sync_type: syncType },
  });
}

/** Número novo (sem coexistência): registra na Cloud API com o PIN da verificação em
 * duas etapas. Sem isso o número não envia. Coexistência NÃO chama isto. */
export function registerPhoneNumber(phoneNumberId: string, token: string, pin: string) {
  return graph<{ success: boolean }>(`${phoneNumberId}/register`, {
    token,
    body: { messaging_product: "whatsapp", pin },
  });
}

/** Dados da WABA (nome, fuso, status da análise). */
export function getWaba(wabaId: string, token: string) {
  return graph<{ id: string; name?: string; timezone_id?: string; message_template_namespace?: string; account_review_status?: string }>(wabaId, {
    token,
    query: { fields: "id,name,timezone_id,message_template_namespace,account_review_status" },
  });
}

export type CloudPhoneNumber = { id: string; display_phone_number: string; verified_name?: string; quality_rating?: string; code_verification_status?: string };

/** Números da WABA (seletor da tela de envio quando a clínica tem mais de um). */
export function listWabaPhoneNumbers(wabaId: string, token: string) {
  return graph<{ data: CloudPhoneNumber[] }>(`${wabaId}/phone_numbers`, {
    token,
    query: { fields: "id,display_phone_number,verified_name,quality_rating,code_verification_status" },
  });
}

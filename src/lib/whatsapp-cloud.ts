import "server-only";

/** Cliente da API oficial do WhatsApp (Cloud API, Graph). Enquanto a conta da clínica
 * estiver com `active: false`, nada aqui é chamado pelo Chat — só pela tela de admin e
 * pelos testes da análise do app. Env: META_APP_ID, META_APP_SECRET (troca do código do
 * Embedded Signup e assinatura do webhook). */

import { META_GRAPH_VERSION } from "@/lib/meta-config";

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

/** Modelo aprovado — o único jeito de iniciar conversa (lembrete D-1 etc.). */
export function sendCloudTemplate(
  phoneNumberId: string,
  token: string,
  to: string,
  template: { name: string; language: string; bodyParams?: string[] }
) {
  return graph<{ messages?: { id: string }[] }>(`${phoneNumberId}/messages`, {
    token,
    body: {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        ...(template.bodyParams?.length
          ? { components: [{ type: "body", parameters: template.bodyParams.map((text) => ({ type: "text", text })) }] }
          : {}),
      },
    },
  });
}

export type CloudTemplate = { id: string; name: string; status: string; category: string; language: string };

export function listCloudTemplates(wabaId: string, token: string) {
  return graph<{ data: CloudTemplate[] }>(`${wabaId}/message_templates`, { token, query: { fields: "id,name,status,category,language", limit: "100" } });
}

/** Cria modelo (vai pra análise da Meta). `body` com {{1}}, {{2}}…; `example` = valores de exemplo. */
export function createCloudTemplate(
  wabaId: string,
  token: string,
  t: { name: string; category: "UTILITY" | "MARKETING"; language: string; body: string; example?: string[] }
) {
  return graph<{ id: string; status: string; category: string }>(`${wabaId}/message_templates`, {
    token,
    body: {
      name: t.name,
      category: t.category,
      language: t.language,
      components: [{ type: "BODY", text: t.body, ...(t.example?.length ? { example: { body_text: [t.example] } } : {}) }],
    },
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

/** Coexistência: pede à Meta pra sincronizar contatos e o histórico (últimos 6 meses) do app
 * WhatsApp Business. Precisa ser chamado em até 24 h depois da conexão — senão o número
 * tem que ser desconectado e conectado de novo. Cada tipo só pode rodar uma vez. */
export function requestCoexistenceSync(phoneNumberId: string, token: string, syncType: "smb_app_state_sync" | "history") {
  return graph<{ request_id?: string }>(`${phoneNumberId}/smb_app_data`, {
    token,
    body: { messaging_product: "whatsapp", sync_type: syncType },
  });
}

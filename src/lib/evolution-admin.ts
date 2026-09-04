import "server-only";
import { getBaseUrl } from "@/lib/format";

export type EvolutionInstanceConfig = {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
};

type EvolutionResult<T> = { success: true; data: T } | { success: false; error: string };

function buildUrl(config: EvolutionInstanceConfig, path: string): string {
  return `${config.apiUrl.replace(/\/$/, "")}${path}`;
}

/** Extrai a mensagem de erro de qualquer formato que a Evolution API costuma usar
 * ({message}, {error}, {response:{message}} como string ou array). */
function extractErrorMessage(body: unknown, status: number, rawText: string): string {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const nested = rec.response as Record<string, unknown> | undefined;
    const candidate = rec.message ?? rec.error ?? nested?.message;
    if (Array.isArray(candidate)) return `HTTP ${status}: ${candidate.join(", ")}`;
    if (typeof candidate === "string" && candidate) return `HTTP ${status}: ${candidate}`;
  }
  const snippet = rawText.replace(/\s+/g, " ").trim().slice(0, 200);
  return snippet ? `HTTP ${status}: ${snippet}` : `HTTP ${status}`;
}

async function evolutionFetch<T>(
  config: EvolutionInstanceConfig,
  path: string,
  init: RequestInit
): Promise<EvolutionResult<T>> {
  try {
    const response = await fetch(buildUrl(config, path), {
      ...init,
      headers: { "Content-Type": "application/json", apikey: config.apiKey, ...init.headers },
      signal: AbortSignal.timeout(15000),
    });
    const rawText = await response.text();
    const body = (() => {
      try {
        return JSON.parse(rawText);
      } catch {
        return null;
      }
    })();
    if (!response.ok) {
      return { success: false, error: extractErrorMessage(body, response.status, rawText) };
    }
    return { success: true, data: (body ?? {}) as T };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro na conexão com a Evolution API" };
  }
}

/** Cria a instância na Evolution API (idempotente na prática — se já existir, a própria API retorna erro que ignoramos ao chamar em sequência com connect). */
export async function createEvolutionInstance(config: EvolutionInstanceConfig) {
  return evolutionFetch<{ instance?: { instanceName: string } }>(config, "/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: config.instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  });
}

/** Configura o webhook da instância pra apontar pro endpoint compartilhado do projeto.
 * MESSAGES_SET carrega a sincronização de histórico (Baileys/WhatsApp multi-dispositivo,
 * ver setEvolutionSyncFullHistory) — sem assinar esse evento aqui, o histórico nunca
 * chega no nosso webhook mesmo com syncFullHistory ativado na instância. */
export async function setEvolutionWebhook(config: EvolutionInstanceConfig) {
  const webhookUrl = `${getBaseUrl()}/api/webhooks/whatsapp`;
  return evolutionFetch<unknown>(config, `/webhook/set/${config.instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        url: webhookUrl,
        enabled: true,
        webhookByEvents: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_SET"],
      },
    }),
  });
}

/** Liga a sincronização de histórico completo (recurso nativo do WhatsApp
 * multi-dispositivo, via Baileys) — só tem efeito prático na PRÓXIMA vez que o
 * número for pareado (desconectar + escanear o QR Code de novo), não em uma
 * instância já conectada. Mantém os outros campos no default (nenhuma clínica
 * customizou nada além disso até agora) pra não resetar configuração por engano. */
export async function setEvolutionSyncFullHistory(config: EvolutionInstanceConfig, enabled: boolean) {
  return evolutionFetch<unknown>(config, `/settings/set/${config.instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      rejectCall: false,
      msgCall: "",
      groupsIgnore: false,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: enabled,
    }),
  });
}

/** Gera/retorna o QR Code atual pra pareamento (base64 pronto pra <img src>). */
export async function getEvolutionQrCode(config: EvolutionInstanceConfig) {
  return evolutionFetch<{ base64?: string; pairingCode?: string }>(
    config,
    `/instance/connect/${config.instanceName}`,
    { method: "GET" }
  );
}

/** Estado atual da conexão Baileys: "open" (conectado), "connecting" ou "close" (desconectado). */
export async function getEvolutionConnectionState(config: EvolutionInstanceConfig) {
  return evolutionFetch<{ instance?: { state?: string } }>(
    config,
    `/instance/connectionState/${config.instanceName}`,
    { method: "GET" }
  );
}

export async function restartEvolutionInstance(config: EvolutionInstanceConfig) {
  return evolutionFetch<unknown>(config, `/instance/restart/${config.instanceName}`, { method: "PUT" });
}

export async function logoutEvolutionInstance(config: EvolutionInstanceConfig) {
  return evolutionFetch<unknown>(config, `/instance/logout/${config.instanceName}`, { method: "DELETE" });
}

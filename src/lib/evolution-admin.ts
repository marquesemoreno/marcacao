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
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (body && typeof body === "object" && "message" in body && String(body.message)) || `HTTP ${response.status}`;
      return { success: false, error: message };
    }
    return { success: true, data: body as T };
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

/** Configura o webhook da instância pra apontar pro endpoint compartilhado do projeto. */
export async function setEvolutionWebhook(config: EvolutionInstanceConfig) {
  const webhookUrl = `${getBaseUrl()}/api/webhooks/whatsapp`;
  return evolutionFetch<unknown>(config, `/webhook/set/${config.instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        url: webhookUrl,
        enabled: true,
        webhookByEvents: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE"],
      },
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

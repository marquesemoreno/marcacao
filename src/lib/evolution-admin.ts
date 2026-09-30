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

/** Domínio usado só pra registrar o webhook na Evolution API — diferente de getBaseUrl()
 * (usado em links visíveis a humanos, ex: QR Code/WhatsApp), que aponta de propósito pro
 * domínio "oficial" sem www. Aqui isso é um problema real: confirmado em produção que
 * `https://conectasaudevc.com.br` responde com 308 redirecionando pra `www.` — bug real
 * relatado por mais de uma clínica ("às vezes" a mensagem não chega no inbox), porque não
 * há garantia de que o disparo de webhook da Evolution API siga esse redirecionamento de
 * forma confiável a cada envio. Registrar direto no destino final elimina esse risco.
 */
function getWebhookBaseUrl(): string {
  const base = getBaseUrl();
  return base === "https://conectasaudevc.com.br" ? "https://www.conectasaudevc.com.br" : base;
}

/** Configura o webhook da instância pra apontar pro endpoint compartilhado do projeto.
 * MESSAGES_SET carrega a sincronização de histórico (Baileys/WhatsApp multi-dispositivo,
 * ver setEvolutionSyncFullHistory) — sem assinar esse evento aqui, o histórico nunca
 * chega no nosso webhook mesmo com syncFullHistory ativado na instância. MESSAGES_DELETE
 * é o que alimenta handleMessageDelete (route.ts) — precisa estar aqui pra QUALQUER
 * instância registrada/atualizada por este código; antes só a Santa Clara tinha esse
 * evento (configurado manualmente fora deste código em algum momento), então recriar o
 * webhook de outra clínica por aqui apagava silenciosamente o "apagar para todos" dela. */
export async function setEvolutionWebhook(config: EvolutionInstanceConfig) {
  const webhookUrl = `${getWebhookBaseUrl()}/api/webhooks/whatsapp`;
  return evolutionFetch<unknown>(config, `/webhook/set/${config.instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        url: webhookUrl,
        enabled: true,
        webhookByEvents: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_SET", "MESSAGES_DELETE"],
      },
    }),
  });
}

type EvolutionSettings = {
  rejectCall?: boolean;
  msgCall?: string;
  groupsIgnore?: boolean;
  alwaysOnline?: boolean;
  readMessages?: boolean;
  readStatus?: boolean;
  syncFullHistory?: boolean;
};

/** Configuração atual salva na instância (Baileys) — usado pra não sobrescrever campos
 * que a clínica já customizou quando só queremos mudar UM campo (`/settings/set` da
 * Evolution API espera o objeto inteiro, não faz merge parcial). */
export async function getEvolutionSettings(config: EvolutionInstanceConfig) {
  return evolutionFetch<EvolutionSettings>(config, `/settings/find/${config.instanceName}`, {
    method: "GET",
  });
}

const DEFAULT_SETTINGS: Required<EvolutionSettings> = {
  rejectCall: false,
  msgCall: "",
  groupsIgnore: false,
  alwaysOnline: false,
  readMessages: false,
  readStatus: false,
  syncFullHistory: false,
};

/** Liga a sincronização de histórico completo (recurso nativo do WhatsApp
 * multi-dispositivo, via Baileys) — só tem efeito prático na PRÓXIMA vez que o
 * número for pareado (desconectar + escanear o QR Code de novo), não em uma
 * instância já conectada. Busca a configuração atual antes de gravar pra não
 * resetar por engano campos que a clínica já customizou (ex: rejectCall/msgCall). */
export async function setEvolutionSyncFullHistory(config: EvolutionInstanceConfig, enabled: boolean) {
  const current = await getEvolutionSettings(config);
  const base = current.success ? current.data : {};
  return evolutionFetch<unknown>(config, `/settings/set/${config.instanceName}`, {
    method: "POST",
    body: JSON.stringify({ ...DEFAULT_SETTINGS, ...base, syncFullHistory: enabled }),
  });
}

/** Limite real da coluna `msgCall` no banco da Evolution API (`varchar(100)`) — confirmado
 * batendo direto no Postgres deles: mensagem maior que isso derruba o INSERT com "value too
 * long for type character varying(100)" e a Evolution devolve um 500 sem indicar a causa
 * (o corpo do erro deles nem cita a coluna certa), então validamos aqui antes de mandar. */
const MSG_CALL_MAX_LENGTH = 100;

/** Ativa/desativa a rejeição automática de chamadas de voz/vídeo — Baileys recusa a
 * ligação na hora e, se `enabled`, manda `message` como texto avulso pro chamador (ex:
 * direcionando pra um número fixo). Busca a config atual primeiro pelo mesmo motivo de
 * `setEvolutionSyncFullHistory`: `/settings/set` grava o objeto inteiro, não faz merge. */
export async function setEvolutionCallBlocking(
  config: EvolutionInstanceConfig,
  enabled: boolean,
  message: string
) {
  if (enabled && message.length > MSG_CALL_MAX_LENGTH) {
    return {
      success: false as const,
      error: `Mensagem tem ${message.length} caracteres, o máximo é ${MSG_CALL_MAX_LENGTH}.`,
    };
  }
  const current = await getEvolutionSettings(config);
  const base = current.success ? current.data : {};
  return evolutionFetch<unknown>(config, `/settings/set/${config.instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      ...DEFAULT_SETTINGS,
      ...base,
      rejectCall: enabled,
      msgCall: enabled ? message : "",
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

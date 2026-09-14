import "server-only";

/** Integração com o GLPI (help desk interno da TIVDC) — cria um Ticket a partir de
 * uma conversa do WhatsApp quando o atendente decide que aquilo é um chamado de
 * suporte (ver botão "Abrir Chamado no GLPI" no menu da conversa, admin). Nunca
 * autônomo: sempre uma decisão explícita do atendente, uma conversa por vez.
 *
 * Sessão do GLPI é curta (abre, cria o ticket, fecha) em vez de manter uma sessão
 * viva entre chamadas — mais simples e mais seguro (sessão não fica pendurada se
 * o processo cair no meio). Credenciais só via env (nunca hardcoded, nunca
 * logadas) — ver .env.example.
 */

function getGlpiConfig() {
  const url = process.env.GLPI_URL;
  const appToken = process.env.GLPI_APP_TOKEN;
  const userToken = process.env.GLPI_USER_TOKEN;
  if (!url || !appToken || !userToken) return null;
  return {
    url: url.replace(/\/$/, ""),
    appToken,
    userToken,
    requestTypeId: process.env.GLPI_REQUESTTYPE_ID ? Number(process.env.GLPI_REQUESTTYPE_ID) : undefined,
  };
}

export function isGlpiConfigured(): boolean {
  return getGlpiConfig() !== null;
}

async function initGlpiSession(config: NonNullable<ReturnType<typeof getGlpiConfig>>): Promise<string | null> {
  try {
    const response = await fetch(`${config.url}/apirest.php/initSession`, {
      method: "GET",
      headers: {
        "App-Token": config.appToken,
        Authorization: `user_token ${config.userToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    return typeof body?.session_token === "string" ? body.session_token : null;
  } catch (error) {
    console.error("Falha ao abrir sessão no GLPI:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function killGlpiSession(config: NonNullable<ReturnType<typeof getGlpiConfig>>, sessionToken: string): Promise<void> {
  try {
    await fetch(`${config.url}/apirest.php/killSession`, {
      method: "GET",
      headers: {
        "App-Token": config.appToken,
        "Session-Token": sessionToken,
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    // Best-effort — a sessão do GLPI expira sozinha mesmo se isso falhar.
    console.error("Falha ao encerrar sessão no GLPI (não crítico):", error instanceof Error ? error.message : error);
  }
}

export type CreateGlpiTicketResult = { success: true; ticketId: number } | { success: false; error: string };

/** Cria um Ticket no GLPI. `name` é o resumo curto (título), `content` o corpo
 * completo (mensagem + telefone do contato, já formatado por quem chama).
 * `entitiesId` (opcional) vincula o chamado à empresa cliente certa no GLPI (ver
 * Contact.glpiEntityId) — sem isso, o GLPI usa a entidade padrão do usuário da
 * API (a raiz, na prática), misturando chamados de empresas diferentes. Nunca
 * lança erro — sempre um resultado tipado, pra quem chama decidir o que mostrar
 * ao atendente sem travar o atendimento do WhatsApp por causa de uma falha aqui. */
export async function createGlpiTicket(name: string, content: string, entitiesId?: number): Promise<CreateGlpiTicketResult> {
  const config = getGlpiConfig();
  if (!config) return { success: false, error: "GLPI não está configurado nesta instância." };

  const sessionToken = await initGlpiSession(config);
  if (!sessionToken) return { success: false, error: "Não foi possível abrir sessão no GLPI." };

  try {
    const response = await fetch(`${config.url}/apirest.php/Ticket`, {
      method: "POST",
      headers: {
        "App-Token": config.appToken,
        "Session-Token": sessionToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          name,
          content,
          ...(config.requestTypeId ? { requesttypes_id: config.requestTypeId } : {}),
          ...(entitiesId !== undefined ? { entities_id: entitiesId } : {}),
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || typeof body?.id !== "number") {
      const message = typeof body?.[1] === "string" ? body[1] : `GLPI respondeu HTTP ${response.status}`;
      console.error("Falha ao criar chamado no GLPI:", message);
      return { success: false, error: "Não foi possível criar o chamado no GLPI." };
    }
    return { success: true, ticketId: body.id };
  } catch (error) {
    console.error("Falha ao criar chamado no GLPI:", error instanceof Error ? error.message : error);
    return { success: false, error: "Erro de rede ao falar com o GLPI." };
  } finally {
    await killGlpiSession(config, sessionToken);
  }
}

export type GlpiEntity = { id: number; name: string };

/** Lista as entidades (empresas clientes) cadastradas no GLPI, pro admin escolher qual
 * vincular a um contato (ver Contact.glpiEntityId). Exclui a Entidade raiz (id 0) — ela
 * não representa uma empresa cliente de verdade, é só o nó topo da hierarquia. Nunca
 * lança erro — devolve lista vazia se o GLPI não estiver configurado ou a chamada falhar. */
export async function listGlpiEntities(): Promise<GlpiEntity[]> {
  const config = getGlpiConfig();
  if (!config) return [];

  const sessionToken = await initGlpiSession(config);
  if (!sessionToken) return [];

  try {
    const response = await fetch(`${config.url}/apirest.php/Entity?range=0-200`, {
      headers: { "App-Token": config.appToken, "Session-Token": sessionToken },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    const body = await response.json().catch(() => null);
    if (!Array.isArray(body)) return [];
    return body
      .filter((entity): entity is { id: number; name: string } => typeof entity?.id === "number" && entity.id !== 0)
      .map((entity) => ({ id: entity.id, name: entity.name }));
  } catch (error) {
    console.error("Falha ao listar entidades do GLPI:", error instanceof Error ? error.message : error);
    return [];
  } finally {
    await killGlpiSession(config, sessionToken);
  }
}

/** URL de visualização do chamado no GLPI — pra linkar na nota interna da conversa. */
export function buildGlpiTicketUrl(ticketId: number): string | null {
  const config = getGlpiConfig();
  if (!config) return null;
  return `${config.url}/front/ticket.form.php?id=${ticketId}`;
}

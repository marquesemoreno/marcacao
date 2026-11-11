/** Recursos públicos (sem login) que ficam DESLIGADOS por padrão desde a auditoria de
 * nov/2026, porque não têm proteção suficiente pra ficar abertos:
 * - painel do marcador: entra com WhatsApp + código de 4 dígitos, sem limite de tentativas,
 *   e o cookie guarda o id cru;
 * - assistente do site (/api/chat): consulta o banco sem limite de taxa.
 * Só religar (variável = "1" na Vercel) depois de corrigir esses pontos. */
export function isAffiliatePanelEnabled(): boolean {
  return process.env.AFFILIATE_PANEL_ENABLED === "1";
}

export function isPublicChatEnabled(): boolean {
  return process.env.PUBLIC_CHAT_ENABLED === "1";
}

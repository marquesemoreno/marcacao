/** Cookie que guarda o código do afiliado capturado via `?ref=CODIGO` (ver middleware.ts). */
export const AFFILIATE_REF_COOKIE = "conecta_affiliate_ref";
export const AFFILIATE_REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

/** Cookie de sessão do painel do marcador (login simples por WhatsApp + código). */
export const AFFILIATE_SESSION_COOKIE = "conecta_affiliate_session";
export const AFFILIATE_SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 dias

/** Comissão fixa por agendamento atribuído a um afiliado — ver docs/obsidian/13. */
export const AFFILIATE_COMMISSION_FLAT = 10;

/** Mascara o nome do paciente para exibir no histórico do marcador sem expor dado sensível. */
export function maskPatientName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts
    .map((part, index) => {
      if (index === 0) return part;
      return part[0] ? `${part[0]}${"*".repeat(Math.max(part.length - 1, 1))}` : part;
    })
    .join(" ");
}

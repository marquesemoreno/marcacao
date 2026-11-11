/** Tipo da campanha de Disparos, lido de BroadcastCampaign.tagOnSend.
 *
 * Marketing é o padrão: só vai para quem aceitou (LGPD) e exige responsável técnico (CFM).
 * Duas exceções transacionais dispensam os dois: o aviso de remarcação (tag
 * RESCHEDULE_PENDING_TAG) e o aviso de serviço das automações (laudo pronto, convênio
 * autorizou). O aviso de serviço usa uma marca interna em tagOnSend, que NÃO é tag de
 * conversa e nunca é aplicada. Quem pediu para sair (opt-out) não recebe em nenhum caso. */
import { RESCHEDULE_PENDING_TAG } from "./conversation-tags";

export const SERVICE_NOTICE_MARK = "__aviso_de_servico__";

export function skipsMarketingConsent(tagOnSend: string | null | undefined): boolean {
  return tagOnSend === RESCHEDULE_PENDING_TAG || tagOnSend === SERVICE_NOTICE_MARK;
}

export function requiresTechnicalDirector(tagOnSend: string | null | undefined): boolean {
  return !skipsMarketingConsent(tagOnSend);
}

/** Tag a pôr na conversa de quem recebeu (null = nenhuma). */
export function tagToApplyOnSend(tagOnSend: string | null | undefined): string | null {
  return tagOnSend && tagOnSend !== SERVICE_NOTICE_MARK ? tagOnSend : null;
}

/** Trava do aviso de serviço: a própria Meta classificou o modelo como "Utilidade" (e não
 * "Marketing"), então não dá para mandar propaganda sem aceite marcando a caixa errada. */
export function isServiceTemplate(template: { category: string }): boolean {
  return template.category.toUpperCase() === "UTILITY";
}

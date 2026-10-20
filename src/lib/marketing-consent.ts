/** Consentimento para campanhas de marketing (LGPD, auditoria 19/10). Guardado por clínica
 * em ContactClinicProfile.marketingConsentAt. Aviso de remarcação é transacional (não
 * precisa) e marcadores são parceiros da clínica, não pacientes. */
export type MarketingDecision = "ENVIAR" | "SAIU" | "SEM_CONSENTIMENTO";

export function marketingSendDecision(input: {
  optedOut: boolean;
  consentAt: Date | null;
  isMarcador: boolean;
  isTransactional: boolean;
}): MarketingDecision {
  if (input.optedOut) return "SAIU";
  if (input.isTransactional || input.isMarcador) return "ENVIAR";
  return input.consentAt ? "ENVIAR" : "SEM_CONSENTIMENTO";
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Paciente pedindo para entrar na lista ("QUERO RECEBER"). Frase inteira, nunca "sim"
 * sozinho (que confirma consulta). Negação ("não quero receber") não conta. */
export function isMarketingOptInReply(text: string): boolean {
  const t = normalize(text);
  if (/\bnao\b/.test(t)) return false;
  return /\bquero receber\b/.test(t);
}

export const MARKETING_OPT_IN_REPLY =
  "Pronto! Você vai receber novidades e campanhas da clínica por aqui. Para sair a qualquer momento, digite 9.";

/** Régua automática (pós-consulta, retorno, reativação): regras puras. A execução diária
 * fica em src/lib/automation-rules-run.ts e cria uma campanha de Disparos por passo/dia,
 * então ritmo, consentimento, opt-out e modelo da API oficial são os mesmos das campanhas. */

export type AutomationRuleKind = "POS_CONSULTA" | "RETORNO" | "REATIVACAO";

export const DEFAULT_RULE_STEPS: {
  kind: AutomationRuleKind;
  name: string;
  daysAfter: number;
  requireNoFuture: boolean;
  messageTemplate: string;
}[] = [
  {
    kind: "POS_CONSULTA",
    name: "Pós-consulta",
    daysAfter: 1,
    requireNoFuture: false,
    messageTemplate: "{{saudacao}}! Aqui é da clínica. Como você está depois da consulta de ontem? Se tiver qualquer dúvida, é só responder por aqui.",
  },
  {
    kind: "RETORNO",
    name: "Retorno",
    daysAfter: 180,
    requireNoFuture: true,
    messageTemplate: "{{saudacao}}! Já faz 6 meses da sua última consulta. Que tal agendar seu retorno? Responda esta mensagem que a gente marca para você.",
  },
  {
    kind: "REATIVACAO",
    name: "Reativação",
    daysAfter: 365,
    requireNoFuture: true,
    messageTemplate: "{{saudacao}}! Sentimos sua falta por aqui — já faz 1 ano da sua última consulta. Quer agendar um horário? É só responder.",
  },
];

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Dia (AAAA-MM-DD, horário de Brasília) que fica `daysAfter` dias antes de hoje. */
export function ruleTargetDate(now: Date, daysAfter: number): string {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS);
  brt.setUTCDate(brt.getUTCDate() - daysAfter);
  return brt.toISOString().slice(0, 10);
}

export function ruleCampaignName(stepName: string, now: Date): string {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS);
  const dd = String(brt.getUTCDate()).padStart(2, "0");
  const mm = String(brt.getUTCMonth() + 1).padStart(2, "0");
  return `Régua · ${stepName} · ${dd}/${mm}`;
}

export function validateRuleInput(input: { daysAfter: number }): string | null {
  if (!Number.isInteger(input.daysAfter) || input.daysAfter < 1 || input.daysAfter > 1095) {
    return "Use entre 1 e 1095 dias depois da consulta.";
  }
  return null;
}

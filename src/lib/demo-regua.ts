/** Modo demo da régua (09/11/2026): a clínica de demonstração não tem API oficial nem sistema
 * conectado, então o Sheet da régua recebe modelos de EXEMPLO e uma prévia fictícia. O cron
 * das 8h pula a clínica demo — nada é enviado. Puro. */
import type { AutomationRuleKind } from "@/lib/automation-rules";
import type { ClinicCloudTemplate } from "@/actions/clinic-broadcast";

const tpl = (name: string, category: string, bodyText: string): ClinicCloudTemplate => ({
  name,
  language: "pt_BR",
  category,
  bodyText,
  variableCount: new Set(bodyText.match(/\{\{\d+\}\}/g) ?? []).size,
});

export const DEMO_CLOUD_TEMPLATES: ClinicCloudTemplate[] = [
  tpl("pos_consulta", "UTILITY", "{{1}}! Aqui é da Clínica Vida. Como você está depois da consulta? Se ficou alguma dúvida, é só responder esta mensagem."),
  tpl("retorno_lembrete", "MARKETING", "{{1}}! Já faz um tempo desde a sua última consulta na Clínica Vida. Que tal agendar o seu retorno? Responda esta mensagem que a gente encontra um horário."),
  tpl("reativacao", "MARKETING", "{{1}}! Sentimos sua falta na Clínica Vida. Quer marcar um check-up? Responda esta mensagem e a recepção te ajuda."),
  tpl("pesquisa_nps", "UTILITY", "Olá, {{1}}! De 0 a 10, quanto você recomendaria a Clínica Vida? Leva 10 segundos: {{2}}"),
  tpl("aniversario", "MARKETING", "Feliz aniversário, {{1}}! 🎉 A equipe da Clínica Vida deseja um ano de muita saúde."),
];

const BASE: Record<AutomationRuleKind, number> = { POS_CONSULTA: 14, RETORNO: 22, REATIVACAO: 30, NPS: 12, ANIVERSARIO: 3 };

/** "Amanhã às 8h: ~N" fictício — muda com o dia e com os dias escolhidos, sempre entre 1 e 40. */
export function demoRuleAudienceCount(kind: AutomationRuleKind, daysAfter: number, today: string): number {
  const key = `${kind}:${kind === "ANIVERSARIO" ? 0 : daysAfter}:${today}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const jitter = ((h >>> 0) % 9) - 4;
  return Math.min(40, Math.max(1, BASE[kind] + jitter));
}

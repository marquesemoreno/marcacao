/** Gatilhos que tiram a conversa do modo IA antes mesmo de chamar o modelo — nunca passam
 * pela IA, são checados no texto puro do paciente. Fixos no código nesta v1 (não editáveis
 * por clínica) pra nenhuma configuração remover um gatilho de segurança sem perceber. */
const ESCALATION_TRIGGERS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(atendente|humano|pessoa de verdade|falar com alguem|falar com algu[eé]m)\b/i, reason: "Pedido explícito de atendente humano" },
  { pattern: /\b(emergencia|emerg[eê]ncia|urgente|urg[eê]ncia)\b/i, reason: "Sinal de urgência/emergência" },
  { pattern: /\b(dor forte|dor insuportavel|dor insuport[aá]vel|sangramento|desmaio|desmaiei|falta de ar|nao consigo respirar|não consigo respirar)\b/i, reason: "Sinal de sintoma grave" },
  { pattern: /\b(reclama[cç][aã]o|processo|processar|advogado|procon)\b/i, reason: "Sinal de reclamação grave" },
];

export function matchEscalationTrigger(text: string): string | null {
  for (const trigger of ESCALATION_TRIGGERS) {
    if (trigger.pattern.test(text)) return trigger.reason;
  }
  return null;
}

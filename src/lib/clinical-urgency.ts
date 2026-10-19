/** Urgência CLÍNICA (sintoma grave ou emergência declarada) — mais estreita que
 * matchEscalationTrigger (ai-attendant.ts), que também tira a conversa da IA por pedido de
 * humano, "urgente" de rotina ("remarcar urgente") ou reclamação. Só esta aqui marca a
 * conversa com URGENCY_TAG e responde com a orientação do 192 (auditoria de saúde, 19/10:
 * o destaque tinha sido desligado porque qualquer "urgente" acendia o alarme). */

const CLINICAL_PATTERNS: RegExp[] = [
  /\b(emergencia|emerg[eê]ncia)\b/i,
  /\b(dor forte|dor insuportavel|dor insuport[aá]vel|dor no peito)\b/i,
  /\b(sangramento|sangrando|hemorragia)\b/i,
  /\b(desmaio|desmaiei|desmaiou|desmaiando)\b/i,
  /\b(falta de ar|nao consigo respirar|não consigo respirar)\b/i,
  /\b(convuls[aã]o|convulsionando|infarto|avc)\b/i,
];

export function matchClinicalUrgency(text: string): string | null {
  return CLINICAL_PATTERNS.some((p) => p.test(text)) ? "Sintoma grave ou emergência relatada" : null;
}

/** Resposta automática quando o paciente relata sintoma grave — orienta antes de qualquer
 * atendente ver a mensagem (fora do horário ninguém responde). */
export const EMERGENCY_GUIDANCE_MESSAGE =
  "Se for uma emergência, ligue agora para o SAMU (192) ou procure o pronto-socorro mais próximo. Nossa equipe também foi avisada e vai te responder assim que possível.";

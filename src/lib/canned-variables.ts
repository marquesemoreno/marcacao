/** Variáveis das respostas rápidas do Chat ("/atalho"): trocadas na hora de inserir no
 * campo de mensagem, ainda editável pela atendente antes de enviar. */
export const CANNED_VARIABLES = [
  { key: "nome", label: "Primeiro nome do paciente" },
  { key: "data", label: "Data do próximo agendamento" },
  { key: "medico", label: "Médico do próximo agendamento" },
  { key: "clinica", label: "Nome da clínica" },
] as const;

export type CannedVariableKey = (typeof CANNED_VARIABLES)[number]["key"];
export type CannedVariableValues = Partial<Record<CannedVariableKey, string | null | undefined>>;

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** Sem valor para a variável, ela fica no texto como está — a atendente vê o `{{medico}}`
 * e preenche à mão, em vez de seguir uma mensagem com lacuna escondida. */
export function fillCannedVariables(content: string, values: CannedVariableValues): string {
  return content.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, rawKey: string) => {
    const key = rawKey.toLowerCase() as CannedVariableKey;
    if (!CANNED_VARIABLES.some((v) => v.key === key)) return match;
    const raw = values[key]?.trim();
    if (!raw) return match;
    return key === "nome" ? firstName(raw) : raw;
  });
}

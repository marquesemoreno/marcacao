import { CANNED_VARIABLES, fillCannedVariables, type CannedVariableValues } from "@/lib/canned-variables";

/** Mensagem opcional ao mover o card no Kanban: só nas etapas em que faz sentido avisar o
 * paciente. A clínica cadastra o texto de cada uma; a recepção revisa antes de enviar. */
export const STAGE_MESSAGE_STAGES = ["orcamento", "agendado"] as const;
export type StageMessageStage = (typeof STAGE_MESSAGE_STAGES)[number];

export const STAGE_MESSAGE_MAX_LENGTH = 1000;

export function stageMessageText(template: string | null | undefined, values: CannedVariableValues) {
  if (!template?.trim()) return null;
  const text = fillCannedVariables(template.trim(), values);
  const unresolved = CANNED_VARIABLES.map((v) => v.key).filter((key) => new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "i").test(text));
  return { text, unresolved };
}

export function normalizeStageMessageTemplate(
  stage: string,
  raw: string
): { ok: true; stage: StageMessageStage; text: string } | { ok: false; error: string } {
  if (!(STAGE_MESSAGE_STAGES as readonly string[]).includes(stage)) return { ok: false, error: "Etapa inválida." };
  const text = raw.trim();
  if (text.length > STAGE_MESSAGE_MAX_LENGTH) {
    return { ok: false, error: `Mensagem muito longa (máx. ${STAGE_MESSAGE_MAX_LENGTH} caracteres).` };
  }
  return { ok: true, stage: stage as StageMessageStage, text };
}

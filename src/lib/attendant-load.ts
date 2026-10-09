/** Carga do atendente no Chat (substitui o limite fixo de conversas abertas, desligado
 * em 09/10/2026). Conta só conversas atribuídas a ele em que o PACIENTE falou por último
 * — as que esperam resposta agora; conversa parada esperando o paciente não pesa. Só
 * avisa, nunca bloqueia. Faixas pelo histórico da Urolaser (set–out/2026): mediana 2–3
 * conversas por hora por atendente, p90 5, máximo 8. */
export const ATTENDANT_LOAD_BUSY_AT = 6;
export const ATTENDANT_LOAD_HIGH_AT = 8;

export type AttendantLoadLevel = "ok" | "busy" | "high";

export function countAwaitingReply(lastDirections: ("INBOUND" | "OUTBOUND" | null | undefined)[]): number {
  return lastDirections.filter((d) => d === "INBOUND").length;
}

export function attendantLoadLevel(awaiting: number): AttendantLoadLevel {
  if (awaiting >= ATTENDANT_LOAD_HIGH_AT) return "high";
  if (awaiting >= ATTENDANT_LOAD_BUSY_AT) return "busy";
  return "ok";
}

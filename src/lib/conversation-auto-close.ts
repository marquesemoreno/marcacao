/** Finalização automática de conversas paradas (cron conversation-auto-close).
 * Só fecha quando a última mensagem foi NOSSA — paciente sem resposta fica aberto. */
export const AUTO_CLOSE_HOURS = 24;
/** Passou disso, fecha sem aviso: evita disparar aviso em massa no acumulado antigo. */
export const AUTO_CLOSE_NOTIFY_MAX_HOURS = 48;
export const AUTO_CLOSE_REASON = "INATIVIDADE";
export const AUTO_CLOSE_NOTICE =
  "Olá! Como não tivemos retorno, estamos finalizando este atendimento. Se precisar de algo, é só mandar uma mensagem por aqui. 😊";

export type AutoCloseDecision = "skip" | "notify_and_close" | "close_silent";

export function decideAutoClose(input: {
  now: Date;
  lastMessageAt: Date;
  lastDirection: "INBOUND" | "OUTBOUND" | null;
  pinned: boolean;
  /** 08–18h (mesma janela dos lembretes) — aviso fora disso espera a próxima rodada. */
  inWindow: boolean;
  /** Clínica com envios automáticos pausados (ex: número restrito pela Meta). */
  paused: boolean;
}): AutoCloseDecision {
  if (input.pinned || input.lastDirection !== "OUTBOUND") return "skip";
  const hours = (input.now.getTime() - input.lastMessageAt.getTime()) / 3600_000;
  if (hours < AUTO_CLOSE_HOURS) return "skip";
  if (hours >= AUTO_CLOSE_NOTIFY_MAX_HOURS || input.paused) return "close_silent";
  return input.inWindow ? "notify_and_close" : "skip";
}

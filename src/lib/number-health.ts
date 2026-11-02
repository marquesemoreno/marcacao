/** "Saúde do número" mostrada em Disparos antes de iniciar uma campanha (crítica 02/11/2026:
 * os dois números foram bloqueados em outubro e a tela não mostrava risco nenhum). */
export type NumberHealthInput = {
  connection: "open" | "down" | "unknown";
  /** Clínica na API oficial: não depende de celular, sem o risco de bloqueio do Evolution. */
  onCloud: boolean;
  /** Última vez que o alerta de saúde viu o número fora do ar. */
  lastDownAt: Date | null;
  /** Mensagens automáticas (lembretes + campanhas de WhatsApp) que saíram hoje. */
  automatedToday: number;
  /** Envios automáticos que falharam hoje. */
  failedToday: number;
  now: Date;
};

export type NumberHealth = {
  tone: "ok" | "warn" | "danger";
  /** Motivos do alerta, em frases curtas. */
  reasons: string[];
  /** Pede uma confirmação extra ("Entendo o risco") antes de iniciar. */
  needsAck: boolean;
  /** Número fora do ar: iniciar não adianta, nada sairia. */
  blocksStart: boolean;
};

export const RECENT_DOWN_DAYS = 30;
export const HIGH_VOLUME = 80;
export const FAILURES_ALERT = 2;

const ddmm = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export function numberHealth(i: NumberHealthInput): NumberHealth {
  if (i.connection === "down") {
    return { tone: "danger", reasons: ["O número está desconectado — nada sai até reconectar."], needsAck: false, blocksStart: true };
  }
  if (i.onCloud) return { tone: "ok", reasons: [], needsAck: false, blocksStart: false };
  const reasons: string[] = [];
  if (i.lastDownAt && i.now.getTime() - i.lastDownAt.getTime() <= RECENT_DOWN_DAYS * 86_400_000) {
    reasons.push(`O número caiu em ${ddmm(i.lastDownAt)} — números que voltaram há pouco são mais vigiados pelo WhatsApp.`);
  }
  if (i.failedToday >= FAILURES_ALERT) reasons.push(`${i.failedToday} envios automáticos falharam hoje.`);
  if (i.automatedToday >= HIGH_VOLUME) reasons.push(`${i.automatedToday} mensagens automáticas já saíram hoje.`);
  return { tone: reasons.length ? "warn" : "ok", reasons, needsAck: reasons.length > 0, blocksStart: false };
}

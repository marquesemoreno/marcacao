import { buildBroadcastMessage } from "@/lib/broadcast-csv";
import { unfilledPlaceholders, unknownTemplateVariables } from "@/lib/broadcast-schedule";

/** Variações de mensagem por campanha (ideia do CRM HYPER): cada destinatário recebe uma
 * das até 3 mensagens, para não mandar texto idêntico a todos e reduzir o risco de
 * bloqueio do número. A escolha é fixa por destinatário (hash do id) — um reenvio após
 * falha manda o mesmo texto. */

function hash(value: string): number {
  // FNV-1a 32 bits: rápido e bem espalhado para ids cuid.
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Variação do destinatário: `index` é a posição na lista original (0 = principal). */
export function pickBroadcastVariant(variants: string[], recipientId: string): { index: number; text: string } {
  const usable = variants.map((text, index) => ({ index, text })).filter((v) => v.text.trim() !== "");
  if (usable.length === 0) return { index: 0, text: variants[0] ?? "" };
  return usable[hash(recipientId) % usable.length];
}

export const MAX_BROADCAST_VARIANTS = 3;

/** Limpa e confere as mensagens de uma campanha: principal obrigatória, variações em
 * branco descartadas, no máximo 3 no total e nenhuma repetida. */
export function normalizeBroadcastVariants(
  main: string,
  extras: string[]
): { ok: true; variants: string[] } | { ok: false; error: string } {
  const first = main.trim();
  if (!first) return { ok: false, error: "Escreva a mensagem principal." };
  const variants = [first, ...extras.map((e) => e.trim()).filter(Boolean)];
  if (variants.length > MAX_BROADCAST_VARIANTS) {
    return { ok: false, error: `No máximo ${MAX_BROADCAST_VARIANTS} mensagens por campanha (a principal e 2 variações).` };
  }
  const key = (text: string) => text.toLowerCase().replace(/\s+/g, " ");
  const seen = new Set<string>();
  for (let i = 0; i < variants.length; i++) {
    if (seen.has(key(variants[i]))) return { ok: false, error: `A variação ${i + 1} é igual a outra mensagem — escreva um texto diferente.` };
    seen.add(key(variants[i]));
  }
  return { ok: true, variants };
}

/** Prévia de cada variação como o paciente vai receber, com os avisos de variável
 * desconhecida e de trecho "[MAIÚSCULO]" sem preencher. */
export function previewBroadcastVariants(
  variants: string[],
  sampleVars: Record<string, string>,
  opts?: { technicalDirector?: string | null }
): { text: string; unknownVariables: string[]; unfilled: string[] }[] {
  return variants.map((v) => ({
    text: buildBroadcastMessage(v, sampleVars, opts),
    unknownVariables: unknownTemplateVariables(v, sampleVars),
    unfilled: unfilledPlaceholders(v),
  }));
}

/** Quantos receberam cada variação (só SENT). Sem variação registrada = principal. */
export function countSentByVariant(rows: { status: string; variantIndex: number | null }[], variantCount: number): number[] {
  const counts = Array.from({ length: Math.max(variantCount, 1) }, () => 0);
  for (const r of rows) {
    if (r.status !== "SENT") continue;
    const i = r.variantIndex ?? 0;
    if (i < counts.length) counts[i]++;
  }
  return counts;
}

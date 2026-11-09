/** Letreiro da TV da sala de espera (09/11/2026): avisos escritos pela clínica + manchetes de
 * Saúde da Agência Brasil (EBC — reprodução livre citando a fonte). Puro, sem rede. */

export const TICKER_NEWS_SOURCE = "Agência Brasil";
export const TICKER_NEWS_FEED = "https://agenciabrasil.ebc.com.br/rss/saude/feed.xml";
export const TICKER_MAX_NOTICES = 10;
export const TICKER_NOTICE_MAX_CHARS = 160;

export type TickerItem = { text: string; source: string | null };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, k) => ENTITIES[k.toLowerCase()] ?? m);

/** Títulos dos <item> do RSS (o <title> do canal fica de fora). */
export function parseRssTitles(xml: string): string[] {
  const out: string[] = [];
  for (const item of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []) {
    const m = item.match(/<title>([\s\S]*?)<\/title>/i);
    if (!m) continue;
    const raw = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
    const t = decode(raw).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  }
  return out;
}

/** Sala de espera de clínica: nada de morte, violência ou tragédia no letreiro. */
const UNSAFE = /\b(mort[aoe]s?|morre\w*|óbitos?|tiros?|baleads?\w*|assassin\w*|estupr\w*|homic\w*|feminic\w*|suic\w*|violên\w*|chacina|tragédia|massacre|cadáver\w*|corpos?)\b/i;
export const isSafeHeadline = (t: string) => !UNSAFE.test(t);

/** Texto da gestão → avisos (um por linha). */
export function normalizeNotices(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim().slice(0, TICKER_NOTICE_MAX_CHARS))
    .filter(Boolean)
    .slice(0, TICKER_MAX_NOTICES);
}

export function buildTickerItems(notices: string[], headlines: string[], { max = 15 }: { max?: number } = {}): TickerItem[] {
  return [
    ...notices.map((text) => ({ text, source: null })),
    ...headlines.filter(isSafeHeadline).map((text) => ({ text, source: TICKER_NEWS_SOURCE })),
  ].slice(0, max);
}

/** Segundos para o letreiro atravessar a tela: ~7 caracteres por segundo, mínimo 20 s. */
export function tickerDurationSec(totalChars: number): number {
  return Math.max(20, Math.round(totalChars / 7));
}

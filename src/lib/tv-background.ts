/** Fundo do painel da TV (09/11/2026): Liso (padrão), Arte suave (gradiente lento nas cores da
 * marca) ou Paisagens (fotos calmas do Unsplash — licença livre para uso comercial, sem crédito
 * obrigatório). Guardado como TvMediaItem kind TV_BACKGROUND (sem migration). Puro. */
export const TV_BACKGROUNDS = ["LISO", "ARTE", "PAISAGENS"] as const;
export type TvBackground = (typeof TV_BACKGROUNDS)[number];
export const TV_BACKGROUND_KIND = "TV_BACKGROUND";

export const TV_BACKGROUND_LABEL: Record<TvBackground, string> = {
  LISO: "Liso",
  ARTE: "Arte suave",
  PAISAGENS: "Paisagens",
};

export function parseTvBackground(v: string | null | undefined): TvBackground {
  return (TV_BACKGROUNDS as readonly string[]).includes(v ?? "") ? (v as TvBackground) : "LISO";
}

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=1920&q=70&auto=format&fit=crop`;

/** Mar, lagos, campos e montanhas — nada com gente, cidade ou cores agressivas. */
export const LANDSCAPES: { url: string; alt: string }[] = [
  { url: unsplash("1474540412665-1cdae210ae6b"), alt: "Mar azul e rosa" },
  { url: unsplash("1444044205806-38f3ed106c10"), alt: "Mar calmo sob nuvens douradas" },
  { url: unsplash("1783677720635-cbaa3144d7c6"), alt: "Lago entre montanhas" },
  { url: unsplash("1532274402911-5a369e4c4bb5"), alt: "Caminho entre flores até um píer" },
  { url: unsplash("1495312040802-a929cd14a6ab"), alt: "Montanhas verdes" },
  { url: unsplash("1533168461629-51f6f8061c68"), alt: "Árvores à beira d'água" },
  { url: unsplash("1784231882494-5450ad619de9"), alt: "Manhã enevoada num campo de flores" },
  { url: unsplash("1550188225-af2e1c2529b2"), alt: "Oceano calmo" },
  { url: unsplash("1761880743944-af860cbcc211"), alt: "Lago ao nascer do sol" },
  { url: unsplash("1615134732800-ca7ef7a3388c"), alt: "Campo verde perto de um lago" },
];

/** Troca a foto a cada 12 min — devagar, para não chamar atenção como vídeo. */
export const LANDSCAPE_PERIOD_MIN = 12;

/** Qual foto mostrar no instante `ms` (todas as TVs da clínica mostram a mesma). */
export function landscapeIndexAt(ms: number): number {
  return Math.floor(ms / (LANDSCAPE_PERIOD_MIN * 60_000)) % LANDSCAPES.length;
}

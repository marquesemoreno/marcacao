"use client";

import { useEffect, useState } from "react";
import { LANDSCAPES, landscapeIndexAt, LANDSCAPE_PERIOD_MIN, type TvBackground } from "@/lib/tv-background";

/** Fundo do painel atrás de tudo (o painel tem `isolate`). Fica escuro o bastante para a senha
 * continuar legível de longe; na chamada (`dim`) escurece mais, para o destaque ir para o nome. */
export function TvBackdrop({ mode, dim }: { mode: TvBackground; dim: boolean }) {
  if (mode === "LISO") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950">
      <style>{KEYFRAMES}</style>
      {mode === "ARTE" ? <SoftArt /> : <Landscapes />}
      {/* Véu: a arte já é escura e desfocada, a foto precisa de mais. */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${mode === "ARTE" ? "from-slate-950/50 via-slate-950/10 to-slate-950/60" : "from-slate-950/80 via-slate-950/55 to-slate-950/85"}`}
      />
      <div className={`absolute inset-0 bg-slate-950 transition-opacity duration-700 ${dim ? "opacity-60" : "opacity-0"}`} />
    </div>
  );
}

const KEYFRAMES = `
@keyframes tvbg-drift-a { 0%,100% { transform: translate(-10%, -8%) scale(1); } 50% { transform: translate(12%, 10%) scale(1.15); } }
@keyframes tvbg-drift-b { 0%,100% { transform: translate(10%, 6%) scale(1.1); } 50% { transform: translate(-12%, -10%) scale(0.95); } }
@keyframes tvbg-drift-c { 0%,100% { transform: translate(0, 12%) scale(1); } 50% { transform: translate(-6%, -12%) scale(1.2); } }
@keyframes tvbg-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tvbg-zoom { from { transform: scale(1); } to { transform: scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .tvbg-anim { animation: none !important; } }
`;

/** Gradiente vivo bem lento nas cores da marca (verde, azul-petróleo, azul). */
function SoftArt() {
  const blob = "tvbg-anim absolute rounded-full blur-[8vw] opacity-90";
  return (
    <>
      <div className={`${blob} -left-[15vw] -top-[20vh] h-[80vh] w-[60vw] bg-emerald-600`} style={{ animation: "tvbg-drift-a 90s ease-in-out infinite" }} />
      <div className={`${blob} -right-[15vw] top-[10vh] h-[85vh] w-[55vw] bg-cyan-700`} style={{ animation: "tvbg-drift-b 110s ease-in-out infinite" }} />
      <div className={`${blob} bottom-[-30vh] left-[20vw] h-[70vh] w-[60vw] bg-indigo-700`} style={{ animation: "tvbg-drift-c 130s ease-in-out infinite" }} />
    </>
  );
}

/** Fotos calmas que se revezam a cada 12 min, com troca lenta (4 s) e um zoom quase parado. */
function Landscapes() {
  const [layers, setLayers] = useState(() => {
    const i = landscapeIndexAt(Date.now());
    return { cur: i, prev: null as number | null };
  });

  useEffect(() => {
    let loading = -1;
    const t = setInterval(() => {
      const i = landscapeIndexAt(Date.now());
      if (i === loading) return;
      loading = i;
      // Carrega antes de trocar, para não piscar fundo vazio.
      const img = new Image();
      img.onload = () => setLayers((x) => (x.cur === i ? x : { cur: i, prev: x.cur }));
      img.src = LANDSCAPES[i].url;
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  // Mesmo estilo em todas (inclusive a primeira, que surge do escuro): mudar a animação de uma
  // foto já na tela reiniciaria o zoom e daria um tranco.
  const photo = (i: number) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={i}
      src={LANDSCAPES[i].url}
      alt=""
      className="tvbg-anim absolute inset-0 h-full w-full object-cover"
      style={{
        animation: `tvbg-fade 4s ease-in-out both, tvbg-zoom ${LANDSCAPE_PERIOD_MIN * 60}s linear both`,
      }}
    />
  );

  return (
    <>
      {layers.prev !== null && photo(layers.prev)}
      {photo(layers.cur)}
    </>
  );
}

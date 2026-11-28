"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Volume2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { getTvBackground, getTvCall, getTvMedia, getTvState, getTvTicker, type TvMediaView } from "@/actions/tv-call";
import { TvBackdrop } from "./tv-backdrop";
import { isLightTvBackground, type TvBackground } from "@/lib/tv-background";
import { TvTicker } from "./tv-ticker";
import type { TickerItem } from "@/lib/tv-ticker";
import { TvMediaStage } from "./tv-media-stage";
import { pushCallHistory, tvSpokenText, type TvCall } from "@/lib/tv-call";
import { audioUnlocked, playChime, speak, unlockAudio } from "@/lib/tv-audio";

const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** TV da sala de espera: chamada atual em destaque, últimas 4 no rodapé. Recebe { id } pelo
 * Realtime e busca a chamada com o token; confere a cada 20 s caso um aviso se perca. As
 * chamadas entram numa fila: gongo + voz uma de cada vez. */
export function TvCallPanel({ token, clinicName, logoUrl = null, topic, initialCalls }: { token: string; clinicName: string; logoUrl?: string | null; topic: string | null; initialCalls: TvCall[] }) {
  const [calls, setCalls] = useState<TvCall[]>(initialCalls);
  const [soundOn, setSoundOn] = useState(false);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [revoked, setRevoked] = useState(false);
  const [media, setMedia] = useState<TvMediaView[]>([]);
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [bg, setBg] = useState<TvBackground>("LISO");
  const seen = useRef(new Set(initialCalls.map((c) => c.id)));
  const queue = useRef<TvCall[]>([]);
  const busy = useRef(false);

  const drain = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length) {
      const call = queue.current.shift()!;
      setCalls((h) => pushCallHistory(h, call));
      setFlash(true);
      if (audioUnlocked()) {
        await playChime();
        await speak(tvSpokenText(call));
        await new Promise((r) => setTimeout(r, 600));
        await speak(tvSpokenText(call)); // repete uma vez, como nos painéis de clínica
      } else {
        await new Promise((r) => setTimeout(r, 4000));
      }
      setFlash(false);
      await new Promise((r) => setTimeout(r, 800));
    }
    busy.current = false;
  }, []);

  const enqueue = useCallback(
    (call: TvCall) => {
      if (seen.current.has(call.id)) return;
      seen.current.add(call.id);
      queue.current.push(call);
      void drain();
    },
    [drain],
  );

  useEffect(() => {
    setSoundOn(audioUnlocked());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Tempo real
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !topic) return;
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "call_patient" }, async ({ payload }) => {
        const id = (payload as { id?: string })?.id;
        if (!id || seen.current.has(id)) return;
        const call = await getTvCall(token, id).catch(() => null);
        if (call) enqueue(call);
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [topic, token, enqueue]);

  // Rede de segurança: confere a cada 20 s (aviso perdido, Wi-Fi caiu).
  useEffect(() => {
    const t = setInterval(async () => {
      const state = await getTvState(token).catch(() => undefined);
      if (state === null) return setRevoked(true);
      if (!state) return;
      for (const c of [...state.calls].reverse()) enqueue(c);
    }, 20_000);
    return () => clearInterval(t);
  }, [token, enqueue]);

  // Vídeos/propaganda/música: carrega e confere a cada 5 min (mudanças na configuração).
  useEffect(() => {
    const load = () => void getTvMedia(token).then((m) => m && setMedia(m)).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [token]);

  // Letreiro (avisos + notícias de saúde) e fundo do painel: confere a cada 15 min.
  useEffect(() => {
    const load = () => {
      void getTvTicker(token).then((t) => t && setTicker(t)).catch(() => {});
      void getTvBackground(token).then((b) => b && setBg(b)).catch(() => {});
    };
    load();
    const t = setInterval(load, 15 * 60_000);
    return () => clearInterval(t);
  }, [token]);

  // Recarrega a página 1×/dia de madrugada (TV ligada direto, vazamento de memória).
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      if (d.getHours() === 4 && d.getMinutes() < 1) window.location.reload();
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  if (revoked) {
    return <div className="flex min-h-dvh items-center justify-center bg-slate-950 p-8 text-center text-2xl text-slate-300">Este link da TV foi desligado. Peça um novo à gestão da clínica.</div>;
  }

  const [current, ...history] = calls;
  const hasMedia = media.length > 0;
  const th = tvTheme(bg);

  if (hasMedia) {
    return (
      <div className={`relative isolate flex h-dvh flex-col ${th.root}`}>
        <TvBackdrop mode={bg} dim={flash} />
        <Header th={th} clinicName={clinicName} logoUrl={logoUrl} soundOn={soundOn} onUnlock={async () => setSoundOn(await unlockAudio())} now={now} />
        <div className="grid min-h-0 flex-1 grid-cols-[7fr_3fr] gap-[1.5vw] px-[2vw] pb-[2vh]">
          <TvMediaStage items={media} ducked={flash} soundOn={soundOn} light={th.light} />
          <aside className="flex min-h-0 flex-col gap-[1.5vh]" aria-live="assertive">
            <div className={`rounded-[1.2vw] border-4 px-[1.5vw] py-[3vh] text-center ${flash ? th.flashCard : `${th.cardBorder} ${th.card}`}`}>
              <p className={`text-[clamp(0.9rem,1.4vw,1.75rem)] uppercase tracking-[0.2em] ${th.label}`}>{current ? "Chamando" : "Aguarde ser chamado"}</p>
              {current && (
                <>
                  <p className="mt-[1vh] text-[clamp(2rem,4.2vw,5.5rem)] font-bold leading-none">{current.displayName}</p>
                  <p className={`mt-[2vh] text-[clamp(1.25rem,2.6vw,3.25rem)] font-semibold ${th.room}`}>{current.room ?? "Recepção"}</p>
                  {current.doctor && <p className={`mt-[0.5vh] text-[clamp(1rem,1.6vw,2rem)] ${th.sub}`}>{current.doctor}</p>}
                </>
              )}
            </div>
            <p className={`text-[clamp(0.8rem,1.1vw,1.25rem)] font-semibold uppercase tracking-widest ${th.muted}`}>Últimas chamadas</p>
            <ol className="flex min-h-0 flex-col gap-[1vh] overflow-hidden">
              {history.slice(0, 4).map((c) => (
                <li key={c.id} className={`rounded-xl ${th.card} ${th.light ? `border ${th.cardBorder}` : ""} px-[1.2vw] py-[1vh]`}>
                  <p className="truncate text-[clamp(1rem,1.8vw,2.25rem)] font-semibold">{c.displayName}</p>
                  <p className={`truncate text-[clamp(0.8rem,1.2vw,1.5rem)] ${th.room}`}>
                    {c.room ?? "Recepção"} <span className={`${th.muted} tabular-nums`}>· {fmt.format(new Date(c.calledAt))}</span>
                  </p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
        <TvTicker items={ticker} hidden={flash} light={th.light} />
        {flash && current && <FocusOverlay call={current} th={th} />}
      </div>
    );
  }

  return (
    <div className={`relative isolate flex min-h-dvh flex-col ${th.root}`}>
      <TvBackdrop mode={bg} dim={flash} />
      <header className="flex items-center justify-between px-[3vw] py-[2vh]">
        <ClinicBrand th={th} clinicName={clinicName} logoUrl={logoUrl} size="lg" />
        <div className="flex items-center gap-4">
          {!soundOn && (
            <button
              type="button"
              onClick={async () => setSoundOn(await unlockAudio())}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-lg font-bold text-slate-950 animate-pulse"
            >
              <Volume2 className="h-6 w-6" aria-hidden /> Toque para ativar o som
            </button>
          )}
          <button
            type="button"
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
            className={`rounded-lg p-2 ${th.icon}`}
            aria-label="Tela cheia"
          >
            <Maximize className="h-6 w-6" />
          </button>
          <p className={`text-[clamp(1.25rem,3vw,3rem)] font-semibold tabular-nums ${th.clock}`}>{fmt.format(now)}</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-[4vw] text-center" aria-live="assertive">
        {current ? (
          <div className={`w-full rounded-[2vw] border-4 px-[4vw] py-[5vh] transition-colors duration-500 ${flash ? th.flashCard : `${th.cardBorder} ${th.card}`}`}>
            <p className={`text-[clamp(1rem,2.2vw,2.5rem)] font-medium uppercase tracking-[0.2em] ${th.label}`}>
              {current.attempt > 1 ? `Chamando de novo · ${current.attempt}ª vez` : "Chamando"}
            </p>
            <p className="mt-[2vh] text-[clamp(3rem,9vw,11rem)] font-bold leading-none tracking-tight">{current.displayName}</p>
            <p className={`mt-[4vh] text-[clamp(2rem,5vw,6rem)] font-semibold ${th.room}`}>{current.room ?? "Recepção"}</p>
            {current.doctor && <p className={`mt-[1.5vh] text-[clamp(1.25rem,2.8vw,3.25rem)] ${th.sub}`}>{current.doctor}</p>}
          </div>
        ) : (
          <p className={`text-[clamp(1.5rem,4vw,4rem)] ${th.muted}`}>Aguarde ser chamado</p>
        )}
      </main>

      <footer className={`border-t ${th.divider} px-[3vw] py-[2.5vh]`}>
        <p className={`mb-[1.5vh] text-[clamp(0.9rem,1.4vw,1.5rem)] font-semibold uppercase tracking-widest ${th.muted}`}>Últimas chamadas</p>
        <ol className="grid grid-cols-2 gap-[1.5vw] md:grid-cols-4">
          {history.slice(0, 4).map((c) => (
            <li key={c.id} className={`rounded-xl ${th.card} ${th.light ? `border ${th.cardBorder}` : ""} px-[1.5vw] py-[1.5vh]`}>
              <p className="truncate text-[clamp(1.1rem,2.2vw,2.5rem)] font-semibold">{c.displayName}</p>
              <p className={`truncate text-[clamp(0.9rem,1.6vw,1.75rem)] ${th.room}`}>
                {c.room ?? "Recepção"} <span className={`${th.muted} tabular-nums`}>· {fmt.format(new Date(c.calledAt))}</span>
              </p>
            </li>
          ))}
        </ol>
      </footer>
      <TvTicker items={ticker} hidden={flash} light={th.light} />
      {flash && current && <FocusOverlay call={current} th={th} />}
    </div>
  );
}

type TvTheme = ReturnType<typeof tvTheme>;

/** Cores do painel. Branco (28/11): tema claro inteiro — verde mais escuro (emerald-700) para
 * manter contraste de longe. Escuros: com arte/paisagem os cartões viram vidro fosco. */
function tvTheme(bg: TvBackground) {
  if (isLightTvBackground(bg)) {
    return {
      light: true,
      root: "bg-slate-50 text-slate-900 [color-scheme:light]",
      card: "bg-white shadow-sm",
      cardBorder: "border-slate-200",
      flashCard: "border-emerald-600 bg-emerald-50",
      label: "text-slate-500",
      muted: "text-slate-500",
      sub: "text-slate-600",
      room: "text-emerald-700",
      clock: "text-slate-700",
      icon: "text-slate-400 hover:text-slate-900",
      divider: "border-slate-200",
      overlay: "bg-white",
      overlayName: "text-slate-950",
      overlayRoom: "text-emerald-700",
      overlaySub: "text-slate-600",
      brandText: "text-emerald-700",
    };
  }
  return {
    light: false,
    root: "bg-slate-950 text-white [color-scheme:dark]",
    card: bg === "LISO" ? "bg-slate-900" : "bg-slate-900/75 backdrop-blur-md",
    cardBorder: "border-slate-800",
    flashCard: "border-emerald-400 bg-emerald-500/15",
    label: "text-slate-400",
    muted: "text-slate-500",
    sub: "text-slate-300",
    room: "text-emerald-400",
    clock: "text-slate-300",
    icon: "text-slate-500 hover:text-white",
    divider: "border-slate-800",
    overlay: "bg-slate-950",
    overlayName: "text-white",
    overlayRoom: "text-emerald-400",
    overlaySub: "text-slate-200",
    brandText: "text-emerald-400",
  };
}

/** Modo foco da chamada (28/11): fundo sólido por cima de tudo (vídeo, fundo animado, letreiro,
 * histórico somem), só o nome e o consultório em verde, o maior possível. Segue o tema: no Branco
 * a tela continua clara (sem escurão na sala). */
function FocusOverlay({ call, th }: { call: TvCall; th: TvTheme }) {
  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${th.overlay} px-[4vw] text-center motion-safe:animate-[tv-focus-in_350ms_ease-out]`} role="alert">
      <style>{`@keyframes tv-focus-in{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}`}</style>
      <p className={`text-[clamp(1.25rem,2.6vw,3rem)] font-semibold uppercase tracking-[0.25em] ${th.label}`}>
        {call.attempt > 1 ? `Chamando de novo · ${call.attempt}ª vez` : "Chamando"}
      </p>
      <p className={`mt-[3vh] text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.95] tracking-tight ${th.overlayName}`}>{call.displayName}</p>
      <p className={`mt-[5vh] text-[clamp(2.5rem,7vw,8rem)] font-bold leading-none ${th.overlayRoom}`}>{call.room ?? "Recepção"}</p>
      {call.doctor && <p className={`mt-[2.5vh] text-[clamp(1.25rem,3vw,3.5rem)] ${th.overlaySub}`}>{call.doctor}</p>}
    </div>
  );
}

/** Logo da clínica (no escuro, numa placa branca — logo escura some no fundo escuro; no Branco,
 * direto na tela) ou, sem logo, o nome. */
function ClinicBrand({ th, clinicName, logoUrl, size }: { th: TvTheme; clinicName: string; logoUrl: string | null; size: "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) {
    return <p className={`${size === "lg" ? "text-[clamp(1rem,2vw,2rem)]" : "text-[clamp(1rem,1.8vw,2rem)]"} font-semibold ${th.brandText}`}>{clinicName}</p>;
  }
  return (
    <div className={th.light ? "py-[0.8vh]" : "rounded-[0.8vw] bg-white px-[1vw] py-[0.8vh] shadow-lg"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt={clinicName} onError={() => setFailed(true)} className={`${size === "lg" ? "h-[7vh]" : "h-[6vh]"} w-auto max-w-[28vw] object-contain`} />
    </div>
  );
}

function Header({ th, clinicName, logoUrl, soundOn, onUnlock, now }: { th: TvTheme; clinicName: string; logoUrl: string | null; soundOn: boolean; onUnlock: () => void; now: Date }) {
  return (
    <header className="flex items-center justify-between px-[2vw] py-[1.5vh]">
      <ClinicBrand th={th} clinicName={clinicName} logoUrl={logoUrl} size="md" />
      <div className="flex items-center gap-4">
        {!soundOn && (
          <button type="button" onClick={onUnlock} className="inline-flex animate-pulse items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-lg font-bold text-slate-950">
            <Volume2 className="h-6 w-6" aria-hidden /> Toque para ativar o som
          </button>
        )}
        <button type="button" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})} className={`rounded-lg p-2 ${th.icon}`} aria-label="Tela cheia">
          <Maximize className="h-6 w-6" />
        </button>
        <p className={`text-[clamp(1.25rem,2.6vw,3rem)] font-semibold tabular-nums ${th.clock}`}>{fmt.format(now)}</p>
      </div>
    </header>
  );
}

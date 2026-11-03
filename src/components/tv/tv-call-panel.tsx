"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Volume2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { getTvCall, getTvState } from "@/actions/tv-call";
import { pushCallHistory, tvSpokenText, type TvCall } from "@/lib/tv-call";
import { audioUnlocked, playChime, speak, unlockAudio } from "@/lib/tv-audio";

const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** TV da sala de espera: chamada atual em destaque, últimas 4 no rodapé. Recebe { id } pelo
 * Realtime e busca a chamada com o token; confere a cada 20 s caso um aviso se perca. As
 * chamadas entram numa fila: gongo + voz uma de cada vez. */
export function TvCallPanel({ token, clinicName, topic, initialCalls }: { token: string; clinicName: string; topic: string | null; initialCalls: TvCall[] }) {
  const [calls, setCalls] = useState<TvCall[]>(initialCalls);
  const [soundOn, setSoundOn] = useState(false);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [revoked, setRevoked] = useState(false);
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

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-white [color-scheme:dark]">
      <header className="flex items-center justify-between px-[3vw] py-[2vh]">
        <p className="text-[clamp(1rem,2vw,2rem)] font-semibold text-emerald-400">{clinicName}</p>
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
            className="rounded-lg p-2 text-slate-500 hover:text-white"
            aria-label="Tela cheia"
          >
            <Maximize className="h-6 w-6" />
          </button>
          <p className="text-[clamp(1.25rem,3vw,3rem)] font-semibold tabular-nums text-slate-300">{fmt.format(now)}</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-[4vw] text-center" aria-live="assertive">
        {current ? (
          <div className={`w-full rounded-[2vw] border-4 px-[4vw] py-[5vh] transition-colors duration-500 ${flash ? "border-emerald-400 bg-emerald-500/15" : "border-slate-800 bg-slate-900"}`}>
            <p className="text-[clamp(1rem,2.2vw,2.5rem)] font-medium uppercase tracking-[0.2em] text-slate-400">
              {current.attempt > 1 ? `Chamando de novo · ${current.attempt}ª vez` : "Chamando"}
            </p>
            <p className="mt-[2vh] text-[clamp(3rem,9vw,11rem)] font-bold leading-none tracking-tight">{current.displayName}</p>
            <p className="mt-[4vh] text-[clamp(2rem,5vw,6rem)] font-semibold text-emerald-400">{current.room ?? "Recepção"}</p>
            {current.doctor && <p className="mt-[1.5vh] text-[clamp(1.25rem,2.8vw,3.25rem)] text-slate-300">{current.doctor}</p>}
          </div>
        ) : (
          <p className="text-[clamp(1.5rem,4vw,4rem)] text-slate-500">Aguarde ser chamado</p>
        )}
      </main>

      <footer className="border-t border-slate-800 px-[3vw] py-[2.5vh]">
        <p className="mb-[1.5vh] text-[clamp(0.9rem,1.4vw,1.5rem)] font-semibold uppercase tracking-widest text-slate-500">Últimas chamadas</p>
        <ol className="grid grid-cols-2 gap-[1.5vw] md:grid-cols-4">
          {history.slice(0, 4).map((c) => (
            <li key={c.id} className="rounded-xl bg-slate-900 px-[1.5vw] py-[1.5vh]">
              <p className="truncate text-[clamp(1.1rem,2.2vw,2.5rem)] font-semibold">{c.displayName}</p>
              <p className="truncate text-[clamp(0.9rem,1.6vw,1.75rem)] text-emerald-400">
                {c.room ?? "Recepção"} <span className="text-slate-500 tabular-nums">· {fmt.format(new Date(c.calledAt))}</span>
              </p>
            </li>
          ))}
        </ol>
      </footer>
    </div>
  );
}

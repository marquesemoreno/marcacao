"use client";

import { useState, useTransition } from "react";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { saveArrivalFence } from "@/actions/queue-ticket";

type Fence = { lat: number | null; lng: number | null; radiusM: number };

/** Ponto da clínica pro QR do celular: a gestão salva estando NA clínica. */
export function ArrivalFenceSettings({ initial }: { initial: Fence }) {
  const [fence, setFence] = useState(initial);
  const [radius, setRadius] = useState(String(initial.radiusM));
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();
  const save = (next: Fence, ok: string) =>
    start(async () => {
      try {
        setFence(await saveArrivalFence(next));
        toast.success(ok);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não deu certo.");
      }
    });

  const useHere = () => {
    if (!navigator.geolocation) return toast.error("Este navegador não dá a localização.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        if (p.coords.accuracy > 300) toast.warning(`Localização imprecisa (±${Math.round(p.coords.accuracy)} m). Se puder, salve pelo celular perto da recepção.`);
        save({ lat: p.coords.latitude, lng: p.coords.longitude, radiusM: Number(radius) || 150 }, "Ponto da clínica salvo");
      },
      () => {
        setLocating(false);
        toast.error("Não deu pra pegar a localização. Libere a localização para este site.");
      },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  const has = fence.lat !== null && fence.lng !== null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-labelledby="fence">
      <h2 id="fence" className="flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-4 w-4 text-emerald-600" aria-hidden /> Confirmar que o paciente está na clínica
      </h2>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        Com o ponto salvo, quem lê o QR Code da recepção precisa liberar a localização e estar perto da clínica para pegar senha. O totem físico não pede. Salve estando na recepção.
      </p>
      <p className="mt-3 text-sm">
        {has ? (
          <>
            Ponto salvo ·{" "}
            <a className="text-emerald-700 underline dark:text-emerald-300" href={`https://www.google.com/maps?q=${fence.lat},${fence.lng}`} target="_blank" rel="noopener noreferrer">
              ver no mapa
            </a>
          </>
        ) : (
          <span className="text-amber-700 dark:text-amber-300">Sem ponto salvo — o QR Code funciona de qualquer lugar.</span>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-sm">
          Raio
          <input
            type="number"
            min={50}
            max={1000}
            step={10}
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            onBlur={() => has && Number(radius) !== fence.radiusM && save({ ...fence, radiusM: Number(radius) }, "Raio salvo")}
            className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          m
        </label>
        <button
          type="button"
          disabled={locating || pending}
          onClick={useHere}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {(locating || pending) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Usar minha localização atual
        </button>
        {has && (
          <button type="button" disabled={pending} onClick={() => save({ lat: null, lng: null, radiusM: fence.radiusM }, "Trava desligada")} className="h-9 rounded-lg px-3 text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40">
            Desligar trava
          </button>
        )}
      </div>
    </section>
  );
}

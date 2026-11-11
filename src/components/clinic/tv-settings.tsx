"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2, MonitorPlay, QrCode, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createTvLink, revokeTvLink, saveDoctorRoom } from "@/actions/tv-call";
import { doctorKey } from "@/lib/tv-call";
import { toTitleCase } from "@/lib/agenda-ui";
import { QRCodeSVG } from "qrcode.react";

/** QR Code pra imprimir e colar na recepção: o paciente avisa que chegou / pega senha pelo celular. */
function ArrivalQr({ url }: { url: string }) {
  const print = () => {
    const svg = document.getElementById("arrival-qr")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<html><head><title>QR Code da recepção</title></head><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h1 style="font-size:36px;margin:0">Chegou?</h1>
      <p style="font-size:22px">Aponte a câmera do celular para avisar a recepção<br>e acompanhar sua vez na fila.</p>
      <div style="margin:30px auto;width:320px">${svg.replace(/width="\d+"/, 'width="320"').replace(/height="\d+"/, 'height="320"')}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };
  return (
    <div className="mt-3 flex items-center gap-4 rounded-lg bg-white p-3 dark:bg-slate-900">
      <QRCodeSVG id="arrival-qr" value={url} size={110} />
      <div className="text-xs text-slate-700 dark:text-slate-300">
        <p className="font-semibold">QR Code da recepção (celular do paciente)</p>
        <p className="mt-1">Imprima e cole no balcão: o paciente avisa que chegou ou pega a senha pelo celular e acompanha a fila.</p>
        <button type="button" onClick={print} className="mt-2 inline-flex h-8 items-center rounded-md border border-slate-300 px-2 font-semibold dark:border-slate-700">
          Imprimir cartaz
        </button>
      </div>
    </div>
  );
}

type Settings = {
  rooms: { doctor: string; room: string }[];
  displays: { id: string; name: string; kind: string; lastSeenAt: string | null }[];
};

const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4";
const input = "h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Configuração da TV: links (gerar/desligar) e sala fixa de cada médico. */
export function TvSettings({ initial, doctors }: { initial: Settings; doctors: string[] }) {
  const [settings, setSettings] = useState(initial);
  const [newUrl, setNewUrl] = useState<{ url: string; kind: "TV" | "TOTEM" | "QR" } | null>(null);
  const [tvName, setTvName] = useState("TV da recepção");
  const [pending, start] = useTransition();
  const roomOf = new Map(settings.rooms.map((r) => [doctorKey(r.doctor), r.room]));
  const allDoctors = [...new Set([...doctors, ...settings.rooms.map((r) => r.doctor)].map((d) => d.trim()))];
  const seenKeys = new Set<string>();
  const doctorList = allDoctors.filter((d) => {
    const k = doctorKey(d);
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });

  return (
    <div className="space-y-4">
      <section className={panel} aria-labelledby="tv-links">
        <h2 id="tv-links" className="flex items-center gap-2 text-sm font-semibold">
          <MonitorPlay className="h-4 w-4 text-emerald-600" aria-hidden /> Link da TV
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Quem tem o link vê os nomes chamados (primeiro nome + inicial). Não mande por WhatsApp a terceiros; se vazar, desligue e gere outro.
        </p>
        <ul className="mt-3 space-y-2">
          {settings.displays.length === 0 && <li className="text-sm text-slate-500">Nenhuma TV ligada ainda.</li>}
          {settings.displays.map((d) => (
            <li key={d.id} className="flex items-center gap-3 text-sm">
              <span className="font-medium">{d.name}</span>
              {d.kind === "QR" && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-200">QR</span>}
              {d.kind === "TOTEM" && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-900 dark:bg-sky-950 dark:text-sky-200">Totem</span>}
              <span className="text-xs text-slate-500">{d.lastSeenAt ? `visto ${fmt.format(new Date(d.lastSeenAt))}` : "ainda não abriu"}</span>
              <button
                type="button"
                onClick={() =>
                  start(async () => {
                    await revokeTvLink(d.id);
                    setSettings((s) => ({ ...s, displays: s.displays.filter((x) => x.id !== d.id) }));
                    toast.success(d.kind !== "TV" ? "Link desligado — o totem para de emitir senhas." : "Link desligado — a TV para de receber chamadas.");
                  })
                }
                className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Desligar
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="tv-name">Nome da TV</label>
          <input id="tv-name" value={tvName} onChange={(e) => setTvName(e.target.value)} className={`${input} w-56`} />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const { id, url } = await createTvLink(tvName);
                setNewUrl({ url, kind: "TV" });
                setSettings((s) => ({ ...s, displays: [...s.displays, { id, name: tvName, kind: "TV", lastSeenAt: null }] }));
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Gerar link da TV
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const { id, url } = await createTvLink("Totem de senhas", "TOTEM");
                setNewUrl({ url, kind: "TOTEM" });
                setSettings((s) => ({ ...s, displays: [...s.displays, { id, name: "Totem de senhas", kind: "TOTEM", lastSeenAt: null }] }));
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium disabled:opacity-60 dark:border-slate-700"
          >
            <Ticket className="h-4 w-4" aria-hidden /> Gerar link do totem de senhas
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const { id, url } = await createTvLink("QR Code da recepção", "QR");
                setNewUrl({ url, kind: "QR" });
                setSettings((s) => ({ ...s, displays: [...s.displays, { id, name: "QR Code da recepção", kind: "QR", lastSeenAt: null }] }));
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium disabled:opacity-60 dark:border-slate-700"
          >
            <QrCode className="h-4 w-4" aria-hidden /> Gerar QR Code da recepção
          </button>
        </div>
        {newUrl && (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">
              {newUrl.kind === "QR" ? "QR Code gerado (ele só aparece agora — imprima o cartaz):" : newUrl.kind === "TOTEM" ? "Abra este endereço no totem (ele só aparece agora):" : "Abra este endereço na TV (ele só aparece agora):"}
            </p>
            {newUrl.kind === "QR" && <ArrivalQr url={newUrl.url} />}
            {newUrl.kind === "TOTEM" && (
              <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
                Impressão sem janela: Chrome com --kiosk --kiosk-printing e a impressora térmica (80 mm) como padrão. Sem impressora, coloque ?imprimir=0 no fim do link — o QR Code aparece na tela.
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs dark:bg-slate-900">{newUrl.url}</code>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(newUrl.url).then(() => toast.success("Link copiado"))}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-300 px-2 text-xs font-semibold text-emerald-800 dark:border-emerald-700 dark:text-emerald-200"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={panel} aria-labelledby="tv-salas">
        <h2 id="tv-salas" className="text-sm font-semibold">Sala de cada médico</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Vale como padrão na chamada (dá pra trocar na hora pela tela do médico). Sem sala, a TV manda o paciente à recepção.
        </p>
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {doctorList.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhum médico com agenda nas últimas/próximas 2 semanas.</li>}
          {doctorList.map((d) => (
            <RoomRow
              key={doctorKey(d)}
              doctor={d}
              room={roomOf.get(doctorKey(d)) ?? ""}
              onSaved={(room) =>
                setSettings((s) => ({ ...s, rooms: [...s.rooms.filter((r) => doctorKey(r.doctor) !== doctorKey(d)), ...(room ? [{ doctor: d, room }] : [])] }))
              }
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function RoomRow({ doctor, room, onSaved }: { doctor: string; room: string; onSaved: (room: string) => void }) {
  const [value, setValue] = useState(room);
  const [pending, start] = useTransition();
  const dirty = value.trim() !== room;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate font-medium">{toTitleCase(doctor)}</span>
      <label className="sr-only" htmlFor={`room-${doctorKey(doctor)}`}>Sala de {doctor}</label>
      <input
        id={`room-${doctorKey(doctor)}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ex.: Consultório 03"
        maxLength={40}
        className={`${input} w-48`}
      />
      <button
        type="button"
        disabled={!dirty || pending}
        onClick={() =>
          start(async () => {
            await saveDoctorRoom({ doctor, room: value });
            onSaved(value.trim());
            toast.success(value.trim() ? `${toTitleCase(doctor)}: ${value.trim()}` : "Sala removida");
          })
        }
        className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium disabled:opacity-40 dark:border-slate-700"
      >
        Salvar
      </button>
    </li>
  );
}

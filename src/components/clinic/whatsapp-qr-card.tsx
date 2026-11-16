"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, QrCode, RotateCw } from "lucide-react";
import { getClinicQrCode, getClinicQrStatus, restartClinicQrConnection } from "@/actions/clinic-whatsapp-qr";

type Status = Awaited<ReturnType<typeof getClinicQrStatus>>;

const LABEL = { CONNECTED: "Conectado", CONNECTING: "Conectando…", DISCONNECTED: "Desconectado" } as const;
const DOT = { CONNECTED: "bg-emerald-500", CONNECTING: "bg-amber-500", DISCONNECTED: "bg-red-500" } as const;

/** Conexão por QR (API não oficial), na mesma tela da API oficial. */
export function WhatsappQrCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"qr" | "restart" | "check" | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
  };

  const refresh = useCallback(async () => {
    const s = await getClinicQrStatus().catch(() => null);
    if (s) setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    refresh();
    return stopPoll;
  }, [refresh]);

  const startPoll = () => {
    stopPoll();
    let n = 0;
    poll.current = setInterval(async () => {
      n += 1;
      const s = await refresh();
      if (s?.configured && s.status === "CONNECTED") {
        stopPoll();
        setQr(null);
        toast.success("WhatsApp conectado");
      }
      if (n >= 30) stopPoll(); // ~1min30
    }, 3000);
  };

  const showQr = async () => {
    setBusy("qr");
    try {
      const r = await getClinicQrCode();
      if (r.success) {
        setQr(r.base64);
        startPoll();
      } else toast.error(r.error);
    } catch {
      toast.error("Não foi possível gerar o QR agora.");
    } finally {
      setBusy(null);
    }
  };

  const restart = async () => {
    setBusy("restart");
    try {
      const r = await restartClinicQrConnection();
      if (r.success) {
        toast.success("Conexão reiniciada");
        setTimeout(refresh, 4000);
      } else toast.error(r.error ?? "Não foi possível reiniciar.");
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    setBusy("check");
    try {
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 ring-slate-300 dark:ring-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60";

  return (
    <section aria-labelledby="qr-card-title" className="glass-surface !rounded-3xl p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="qr-card-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Conexão por QR (WhatsApp Business no celular)
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            É a conexão atual do Chat, dos lembretes e dos disparos enquanto a clínica não usa a API oficial.
          </p>
        </div>
        {status?.configured && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span aria-hidden className={`h-2 w-2 rounded-full ${DOT[status.status]}`} />
            {LABEL[status.status]}
          </span>
        )}
      </div>

      {status === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Consultando a conexão…</p>
      ) : !status.configured ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Esta clínica usa a conexão gerenciada pelo suporte da Conecta Saúde. Para reconectar, fale com o suporte.</p>
      ) : (
        <>
          {status.error && <p className="text-sm text-amber-700 dark:text-amber-300">{status.error}</p>}
          <div className="flex flex-wrap gap-2">
            {status.status !== "CONNECTED" && (
              <button type="button" onClick={showQr} disabled={busy !== null} className={`${btn} !text-white !ring-0 bg-emerald-600 hover:!bg-emerald-700`}>
                {busy === "qr" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <QrCode className="h-4 w-4" aria-hidden />}
                Mostrar QR para conectar
              </button>
            )}
            <button type="button" onClick={check} disabled={busy !== null} className={btn}>
              {busy === "check" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Verificar agora
            </button>
            <button type="button" onClick={restart} disabled={busy !== null} className={btn}>
              {busy === "restart" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCw className="h-4 w-4" aria-hidden />}
              Reiniciar conexão
            </button>
          </div>
          {qr && (
            <div className="flex flex-col sm:flex-row items-start gap-4 rounded-2xl bg-white p-4 text-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR em base64 vindo da Evolution */}
              <img src={qr} alt="QR Code para conectar o WhatsApp da clínica" className="h-52 w-52" />
              <ol className="list-decimal pl-5 text-sm space-y-1">
                <li>No celular da clínica, abra o <strong>WhatsApp Business</strong>.</li>
                <li>Toque em <strong>⋮ › Dispositivos conectados › Conectar dispositivo</strong>.</li>
                <li>Aponte a câmera para este QR. A tela atualiza sozinha quando conectar.</li>
                <li className="text-slate-500">O QR expira em cerca de 1 minuto. Se expirar, gere outro.</li>
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}

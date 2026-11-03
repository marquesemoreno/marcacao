"use client";

import { useEffect, useRef, useState } from "react";
import { getTicketFollow } from "@/actions/queue-ticket";
import type { TicketFollow } from "@/lib/queue-ticket-server";
import { toTitleCase } from "@/lib/agenda-ui";

const POLL_MS = 15_000;

/** Celular do paciente (QR Code da senha): posição na fila, atualiza a cada 15 s. */
export function TicketFollowView({ token, initial }: { token: string; initial: TicketFollow }) {
  const [t, setT] = useState<TicketFollow | null>(initial);
  const lastCalled = useRef(initial.calledAt);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const next = await getTicketFollow(token).catch(() => undefined);
      if (next === undefined) return;
      if (next?.calledAt && next.calledAt !== lastCalled.current) {
        lastCalled.current = next.calledAt;
        navigator.vibrate?.([300, 150, 300]);
      }
      setT(next);
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [token]);

  if (!t) {
    return <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-6 text-center text-lg text-slate-700 [color-scheme:light]">Esta senha não vale mais.</main>;
  }

  const called = t.status === "CALLED";
  const where = t.room ? t.room : "a recepção";
  return (
    <main className={`flex min-h-dvh flex-col items-center px-6 py-10 text-center [color-scheme:light] ${called ? "bg-emerald-700 text-white" : "bg-slate-50 text-slate-900"}`}>
      <p className={`text-sm font-medium ${called ? "text-emerald-100" : "text-slate-500"}`}>{t.clinicName}</p>
      <p className={`mt-8 text-base ${called ? "text-emerald-100" : "text-slate-600"}`}>Sua senha</p>
      <p className="text-7xl font-black tracking-tight">{t.code}</p>

      <div aria-live="polite" className="mt-10 max-w-sm">
        {t.status === "WAITING" && (
          <>
            <p className="text-5xl font-bold">{t.ahead}</p>
            <p className="mt-1 text-lg">{t.ahead === 0 ? "Você é o próximo!" : t.ahead === 1 ? "senha na sua frente" : "senhas na sua frente"}</p>
            {t.doctor && (
              <p className="mt-4 text-base">
                {toTitleCase(t.doctor)}
                {t.delayMin !== null && t.delayMin >= 10 ? <> está com cerca de <strong>{Math.round(t.delayMin / 5) * 5} min</strong> de atraso.</> : " está no horário."}
              </p>
            )}
            <p className="mt-6 text-sm text-slate-500">Deixe esta página aberta — ela se atualiza sozinha. Fique atento à TV da sala de espera.</p>
          </>
        )}
        {called && (
          <>
            <p className="text-3xl font-bold">É a sua vez!</p>
            <p className="mt-2 text-xl">Dirija-se {t.room ? (/^(sala|recepç|recepc)/i.test(t.room) ? "à " : "ao ") : "à "}{where}.</p>
          </>
        )}
        {t.status === "DONE" && <p className="text-xl">Atendimento registrado. Obrigado!</p>}
        {(t.status === "NO_SHOW" || t.status === "CANCELLED") && <p className="text-xl">Esta senha foi encerrada. Se ainda precisa de atendimento, fale com a recepção.</p>}
      </div>
    </main>
  );
}

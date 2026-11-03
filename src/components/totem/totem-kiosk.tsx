"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Delete, Loader2, Printer } from "lucide-react";
import { takeTicket } from "@/actions/queue-ticket";
import type { IssuedTicket } from "@/lib/queue-ticket-server";
import type { TicketType } from "@/lib/queue-ticket";

type Step = { kind: "type" } | { kind: "id"; type: TicketType } | { kind: "ticket"; ticket: IssuedTicket };

const IDLE_MS = 45_000; // sem toque no teclado: volta pro início
const TICKET_MS = 20_000; // tela da senha impressa

const fmtTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" });

/** Totem: escolhe Normal/Preferencial → CPF ou telefone (ou pula) → senha impressa com QR Code.
 * Impressão silenciosa: Chrome com --kiosk-printing e a térmica como impressora padrão. */
/** `mobile` = aberto pelo QR Code da recepção no celular do paciente: depois da senha vai
 * direto pra página de acompanhamento da fila. */
export function TotemKiosk({ token, clinicName, print, mobile = false }: { token: string; clinicName: string; print: boolean; mobile?: boolean }) {
  const [step, setStep] = useState<Step>({ kind: "type" });
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setStep({ kind: "type" });
    setDigits("");
    setError(null);
  };

  // Volta sozinho pro início (paciente desistiu / já pegou a senha).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (step.kind === "type" || mobile) return;
    timer.current = setTimeout(reset, step.kind === "ticket" ? TICKET_MS : IDLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [step, digits]);

  // Imprime assim que a senha aparece.
  useEffect(() => {
    if (step.kind !== "ticket" || !print) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [step, print]);

  const issue = (type: TicketType, identifier: string | null) =>
    start(async () => {
      setError(null);
      const res = await takeTicket(token, { type, identifier });
      if (!res.ok) return setError(res.error);
      if (mobile) return window.location.replace(`/senha/${res.ticket.followToken}`);
      setStep({ kind: "ticket", ticket: res.ticket });
      setDigits("");
    });

  const followUrl = step.kind === "ticket" ? `${window.location.origin}/senha/${step.ticket.followToken}` : "";
  const validId = digits.length === 10 || digits.length === 11;

  return (
    <main className="flex min-h-dvh select-none flex-col bg-slate-50 text-slate-900 [color-scheme:light] print:bg-white">
      <style>{`@media print { @page { size: 80mm auto; margin: 3mm; } .totem-screen { display: none !important; } .totem-print { display: block !important; } }`}</style>

      <div className="totem-screen flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-[4vw] py-[2.5vh]">
          <p className="text-[clamp(1.25rem,2.4vw,2.25rem)] font-semibold">{clinicName}</p>
          {step.kind !== "type" && (
            <button type="button" onClick={reset} className="inline-flex h-14 items-center gap-2 rounded-xl px-5 text-xl font-medium text-slate-600 active:bg-slate-100">
              <ArrowLeft className="h-6 w-6" aria-hidden /> Início
            </button>
          )}
        </header>

        <section className="flex flex-1 flex-col items-center justify-center gap-[4vh] px-[5vw] py-[4vh]">
          {step.kind === "type" && (
            <>
              <h1 className="text-center text-[clamp(2rem,4.5vw,4rem)] font-bold tracking-tight">{mobile ? "Chegou? Pegue sua senha" : "Retire sua senha"}</h1>
              {mobile && <p className="-mt-4 text-center text-lg text-slate-600">Com consulta marcada, digite seu CPF ou telefone no próximo passo e a recepção já fica sabendo.</p>}
              <div className="grid w-full max-w-5xl gap-[3vw] md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setStep({ kind: "id", type: "N" })}
                  className="flex min-h-[28vh] flex-col items-center justify-center rounded-3xl bg-emerald-700 p-8 text-white shadow-lg active:scale-[0.98] active:bg-emerald-800"
                >
                  <span className="text-[clamp(2.5rem,5vw,4.5rem)] font-bold">Normal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep({ kind: "id", type: "P" })}
                  className="flex min-h-[28vh] flex-col items-center justify-center rounded-3xl bg-sky-800 p-8 text-white shadow-lg active:scale-[0.98] active:bg-sky-900"
                >
                  <span className="text-[clamp(2.5rem,5vw,4.5rem)] font-bold">Preferencial</span>
                  <span className="mt-3 max-w-md text-center text-[clamp(1rem,1.6vw,1.4rem)] text-sky-100">
                    60 anos ou mais, gestante, lactante, criança de colo, pessoa com deficiência ou TEA, obesidade
                  </span>
                </button>
              </div>
            </>
          )}

          {step.kind === "id" && (
            <div className="flex w-full max-w-xl flex-col items-center gap-[2.5vh]">
              <h1 className="text-center text-[clamp(1.75rem,3.6vw,3.25rem)] font-bold leading-tight">Digite seu CPF ou telefone</h1>
              <p className="-mt-2 text-center text-xl text-slate-600">Assim avisamos a recepção que você chegou.</p>
              <output aria-live="polite" className="flex h-20 w-full items-center justify-center rounded-2xl border-2 border-slate-300 bg-white font-mono text-[2.5rem] tracking-widest">
                {digits || <span className="text-slate-300">___________</span>}
              </output>
              <div className="grid w-full grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <Key key={d} onClick={() => setDigits((x) => (x.length < 11 ? x + d : x))}>{d}</Key>
                ))}
                <Key onClick={() => setDigits("")} label="Limpar"><span className="text-xl">Limpar</span></Key>
                <Key onClick={() => setDigits((x) => (x.length < 11 ? x + "0" : x))}>0</Key>
                <Key onClick={() => setDigits((x) => x.slice(0, -1))} label="Apagar"><Delete className="h-9 w-9" aria-hidden /></Key>
              </div>
              {error && <p role="alert" className="text-center text-xl font-medium text-rose-700">{error}</p>}
              <button
                type="button"
                disabled={!validId || pending}
                onClick={() => issue(step.type, digits)}
                className="inline-flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 text-[1.75rem] font-bold text-white active:bg-emerald-800 disabled:bg-slate-300"
              >
                {pending && <Loader2 className="h-8 w-8 animate-spin" aria-hidden />} Tirar senha
              </button>
              <button type="button" disabled={pending} onClick={() => issue(step.type, null)} className="h-16 w-full rounded-2xl text-xl font-medium text-slate-700 underline-offset-4 active:bg-slate-100">
                Não tenho consulta marcada / pular
              </button>
            </div>
          )}

          {step.kind === "ticket" && (
            <div className="flex w-full max-w-3xl flex-col items-center gap-[2.5vh] text-center">
              <p className="text-2xl font-medium text-slate-600">Sua senha</p>
              <p className="text-[clamp(5rem,14vw,11rem)] font-black leading-none tracking-tight text-emerald-800">{step.ticket.code}</p>
              <p className="text-2xl">
                {step.ticket.patient
                  ? <>Olá, <strong>{step.ticket.patient}</strong>{step.ticket.appointmentTime ? <> — consulta às <strong>{step.ticket.appointmentTime}</strong></> : null}. Sua chegada foi registrada.</>
                  : "Aguarde ser chamado na TV. A recepção vai te atender."}
              </p>
              <p className="text-xl text-slate-600">
                {step.ticket.ahead === 0 ? "Você é o próximo." : `${step.ticket.ahead} ${step.ticket.ahead === 1 ? "senha" : "senhas"} na sua frente.`}
              </p>
              <div className="flex items-center gap-6 rounded-2xl border border-slate-200 bg-white p-5 text-left">
                <QRCodeSVG value={followUrl} size={150} />
                <p className="max-w-xs text-xl">Aponte a câmera do celular para acompanhar sua vez.</p>
              </div>
              <div className="flex gap-3">
                {print && (
                  <button type="button" onClick={() => window.print()} className="inline-flex h-16 items-center gap-2 rounded-2xl border-2 border-slate-300 px-6 text-xl font-medium active:bg-slate-100">
                    <Printer className="h-6 w-6" aria-hidden /> Imprimir de novo
                  </button>
                )}
                <button type="button" onClick={reset} className="h-16 rounded-2xl bg-emerald-700 px-10 text-xl font-bold text-white active:bg-emerald-800">
                  Pronto
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {step.kind === "ticket" && (
        <div className="totem-print hidden text-center font-sans text-black">
          <p style={{ fontSize: "12pt", fontWeight: 600 }}>{clinicName}</p>
          <p style={{ fontSize: "10pt", marginTop: "2mm" }}>{step.ticket.type === "P" ? "PREFERENCIAL" : "NORMAL"}</p>
          <p style={{ fontSize: "40pt", fontWeight: 900, lineHeight: 1.1 }}>{step.ticket.code}</p>
          {step.ticket.patient && (
            <p style={{ fontSize: "10pt" }}>
              {step.ticket.patient}
              {step.ticket.appointmentTime ? ` · consulta ${step.ticket.appointmentTime}` : ""}
            </p>
          )}
          <p style={{ fontSize: "9pt", marginTop: "1mm" }}>{fmtTime.format(new Date(step.ticket.createdAt))}</p>
          <div style={{ display: "flex", justifyContent: "center", margin: "3mm 0" }}>
            <QRCodeSVG value={followUrl} size={130} />
          </div>
          <p style={{ fontSize: "9pt" }}>Acompanhe sua vez pelo celular</p>
        </div>
      )}
    </main>
  );
}

function Key({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-[min(11vh,6rem)] items-center justify-center rounded-2xl border border-slate-200 bg-white text-[2.25rem] font-semibold shadow-sm active:bg-slate-100"
    >
      {children}
    </button>
  );
}

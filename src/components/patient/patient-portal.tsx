"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, MapPin } from "lucide-react";
import { patientCheckIn, submitPatientForm, type loadPatientPortal } from "@/actions/patient-portal";
import type { FormQuestion } from "@/lib/patient-form";

type Data = Extract<Awaited<ReturnType<typeof loadPatientPortal>>, { state: "VALID" }>;

const card = "rounded-xl border border-slate-200 bg-white p-5";
const primary =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2";

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** Página do paciente (link do lembrete): dados da consulta, ficha prévia e "Cheguei".
 * Pensada pro celular: um campo por linha, alvos de 48px, texto 16px (sem zoom no iOS). */
export function PatientPortal({ token, data }: { token: string; data: Data }) {
  const [formDone, setFormDone] = useState(!!data.formDoneAt);
  const [checkedIn, setCheckedIn] = useState(data.checkedIn);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-medium text-emerald-700">{data.clinicName}</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight">{data.firstName ? `Olá, ${data.firstName}!` : "Olá!"}</h1>
        {data.visit && (
          <p className="mt-1 text-base text-slate-700 first-letter:uppercase">
            {longDate(data.visit.date)}
            {data.visit.time ? ` às ${data.visit.time}` : ""}
            {data.visit.doctor ? ` · ${data.visit.doctor}` : ""}
          </p>
        )}
      </header>

      <CheckInCard token={token} window={data.checkin} done={checkedIn} onDone={() => setCheckedIn(true)} />

      {formDone ? (
        <div className={`${card} flex items-start gap-3`}>
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className="font-semibold">Ficha enviada</p>
            <p className="text-sm text-slate-600">Obrigado! A equipe já recebeu suas respostas.</p>
          </div>
        </div>
      ) : data.form ? (
        <FormCard token={token} questions={data.form.questions} term={data.term} onDone={() => setFormDone(true)} />
      ) : null}
    </div>
  );
}

function CheckInCard({ token, window, done, onDone }: { token: string; window: "EARLY" | "OPEN" | "CLOSED"; done: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  if (done) {
    return (
      <div className={`${card} flex items-start gap-3 border-sky-200 bg-sky-50`}>
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
        <div>
          <p className="font-semibold">Chegada avisada</p>
          <p className="text-sm text-slate-600">A recepção já sabe que você está aqui. Aguarde ser chamado.</p>
          {ticketCode && (
            <p className="mt-2 text-sm">
              Sua senha: <strong className="font-mono text-lg">{ticketCode}</strong> — fique atento à TV da sala de espera.
            </p>
          )}
        </div>
      </div>
    );
  }
  if (window !== "OPEN") return null;
  return (
    <div className={card}>
      <p className="flex items-center gap-2 font-semibold">
        <MapPin className="h-4 w-4 text-emerald-600" aria-hidden /> Já está na clínica?
      </p>
      <p className="mt-1 text-sm text-slate-600">Avise sua chegada por aqui — a recepção vê na hora.</p>
      <button
        type="button"
        disabled={busy}
        className={`${primary} mt-3`}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await patientCheckIn(token).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
          setBusy(false);
          if (r.ok) {
            // Clínica com senhas: já abre o acompanhamento da fila.
            if (r.ticket?.followToken) return globalThis.location.assign(`/senha/${r.ticket.followToken}`);
            if (r.ticket) setTicketCode(r.ticket.code);
            onDone();
          }
          else setError(r.error);
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Cheguei
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

function FormCard({
  token,
  questions,
  term,
  onDone,
}: {
  token: string;
  questions: FormQuestion[];
  term: { id: string; title: string; body: string };
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));
  const visible = questions.filter((q) => !q.showIf || answers[q.showIf.id] === q.showIf.equals);

  return (
    <form
      className={card}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await submitPatientForm(token, answers, term.id, accepted).catch(() => ({
          ok: false as const,
          error: "Sem conexão. Suas respostas continuam aqui — tente de novo.",
          errors: undefined,
        }));
        setBusy(false);
        if (r.ok) return onDone();
        setErrors(r.errors ?? {});
        setError(r.error ?? "Confira os campos marcados.");
      }}
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <ClipboardList className="h-5 w-5 text-emerald-600" aria-hidden /> Ficha antes da consulta
      </h2>
      <p className="mt-1 text-sm text-slate-600">Leva uns 2 minutos e agiliza seu atendimento.</p>

      <div className="mt-4 space-y-5">
        {visible.map((q) => (
          <fieldset key={q.id} aria-invalid={!!errors[q.id]} aria-describedby={errors[q.id] ? `err-${q.id}` : undefined}>
            <legend className="text-base font-medium">
              {q.label}
              {!q.required && <span className="ml-1 text-sm font-normal text-slate-500">(opcional)</span>}
            </legend>
            {q.type === "text" ? (
              <textarea
                rows={2}
                maxLength={2000}
                value={answers[q.id] ?? ""}
                onChange={(e) => set(q.id, e.target.value)}
                aria-label={q.label}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              />
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {(q.type === "yesno" ? [["sim", "Sim"], ["nao", "Não"]] : (q.options ?? []).map((o) => [o, o])).map(([value, label]) => (
                  <label
                    key={value}
                    className={`inline-flex h-12 min-w-[5rem] cursor-pointer items-center justify-center rounded-lg border px-4 text-base has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500/50 ${
                      answers[q.id] === value ? "border-emerald-600 bg-emerald-50 font-semibold text-emerald-900" : "border-slate-300 bg-white"
                    }`}
                  >
                    <input type="radio" name={q.id} value={value} checked={answers[q.id] === value} onChange={() => set(q.id, value)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            )}
            {errors[q.id] && (
              <p id={`err-${q.id}`} className="mt-1 text-sm text-rose-700">
                {errors[q.id] === "Obrigatório" ? "Responda esta pergunta." : errors[q.id]}
              </p>
            )}
          </fieldset>
        ))}
      </div>

      <details className="mt-6 rounded-lg bg-slate-50 p-3 text-sm">
        <summary className="cursor-pointer font-medium">{term.title}</summary>
        <div className="mt-2 space-y-2 whitespace-pre-line text-slate-700">{term.body}</div>
      </details>
      <label className="mt-3 flex items-start gap-3 text-base">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-5 w-5 accent-emerald-600" />
        <span>Li e concordo com o uso dos meus dados para o atendimento.</span>
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={`${primary} mt-4`}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Enviar ficha
      </button>
    </form>
  );
}

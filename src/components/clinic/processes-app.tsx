"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  askProcess,
  saveProcess,
  sendProcessFeedback,
  setProcessPublished,
  updateProcessFeedback,
} from "@/actions/processes";
import { FEEDBACK_LABELS, SECTOR_LABELS, isProcessSector, type FeedbackKind } from "@/lib/processes";

type Process = {
  id: string;
  sector: string;
  title: string;
  body: string;
  status: string;
  version: number;
  changeNote: string | null;
  publishedAt: string | null;
  updatedAt: string;
};
type Feedback = {
  id: string;
  kind: string;
  text: string;
  status: string;
  aiAnswer: string | null;
  managerReply: string | null;
  createdAt: string;
  process: { title: string };
  author?: string;
};

const card = "rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xs";
const input =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40";
const btn = "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium disabled:opacity-50";
const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const STATUS_LABEL: Record<string, string> = { NOVA: "Nova", VISTA: "Vista", RESOLVIDA: "Resolvida" };

function run(start: (cb: () => Promise<void>) => void, fn: () => Promise<unknown>, ok: string) {
  start(async () => {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu certo.");
    }
  });
}

export function ProcessesApp({
  manager,
  processes,
  feedback,
  mine,
}: {
  manager: boolean;
  processes: Process[];
  feedback: Feedback[];
  mine: Feedback[];
}) {
  const [tab, setTab] = useState<"processos" | "mensagens" | "minhas">("processos");
  const [selectedId, setSelectedId] = useState(processes[0]?.id ?? null);
  const selected = processes.find((p) => p.id === selectedId) ?? null;
  const pendingCount = feedback.filter((f) => f.status === "NOVA").length;

  if (processes.length === 0) {
    return <p className={`${card} text-sm text-slate-600`}>A gestão ainda não publicou nenhum processo.</p>;
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-1 text-sm">
        {(
          [
            ["processos", "Processos"],
            ...(manager ? [["mensagens", `Mensagens da equipe${pendingCount ? ` (${pendingCount})` : ""}`]] : []),
            ["minhas", "Minhas mensagens"],
          ] as [typeof tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 ${tab === key ? "bg-white dark:bg-slate-950 font-semibold shadow-xs" : "text-slate-600 dark:text-slate-400"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "processos" && (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <nav aria-label="Setores" className="space-y-1">
            {processes.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                  p.id === selectedId ? "bg-white dark:bg-slate-900 font-semibold shadow-xs" : "hover:bg-white/60 dark:hover:bg-slate-900/60"
                }`}
              >
                <span className="block text-xs text-slate-500">{isProcessSector(p.sector) ? SECTOR_LABELS[p.sector] : p.sector}</span>
                {p.title}
                {p.status !== "PUBLISHED" && <span className="ml-1.5 rounded bg-amber-100 dark:bg-amber-900/50 px-1.5 text-xs text-amber-800 dark:text-amber-200">rascunho</span>}
              </button>
            ))}
          </nav>
          {selected && <ProcessView key={selected.id} process={selected} manager={manager} />}
        </div>
      )}

      {tab === "mensagens" && manager && <FeedbackList rows={feedback} manage />}
      {tab === "minhas" && <FeedbackList rows={mine} />}
    </div>
  );
}

function ProcessView({ process: p, manager }: { process: Process; manager: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(p.title);
  const [body, setBody] = useState(p.body);
  const [changeNote, setChangeNote] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [kind, setKind] = useState<FeedbackKind>("OPINIAO");
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  return (
    <div className="space-y-4">
      <article className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{p.title}</h2>
            <p className="text-xs text-slate-500">
              {p.status === "PUBLISHED"
                ? `Versão ${p.version} · publicada em ${p.publishedAt ? fmt.format(new Date(p.publishedAt)) : "—"}${p.changeNote ? ` · ${p.changeNote}` : ""}`
                : "Rascunho — só a gestão vê. Revise e publique."}
            </p>
          </div>
          {manager && !editing && (
            <div className="flex gap-2">
              <button className={`${btn} bg-slate-100 dark:bg-slate-800`} onClick={() => setEditing(true)}>
                Editar
              </button>
              <button
                disabled={pending}
                className={`${btn} ${p.status === "PUBLISHED" ? "bg-slate-100 dark:bg-slate-800" : "bg-emerald-600 text-white"}`}
                onClick={() =>
                  run(start, () => setProcessPublished(p.id, p.status !== "PUBLISHED"), p.status === "PUBLISHED" ? "Voltou para rascunho." : "Publicado para a equipe.")
                }
              >
                {p.status === "PUBLISHED" ? "Despublicar" : "Publicar"}
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="mt-4 space-y-2">
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título" />
            <textarea className={`${input} min-h-80 font-mono`} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Texto do processo" />
            {p.status === "PUBLISHED" && (
              <input className={input} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="O que mudou? (aparece para a equipe)" />
            )}
            <div className="flex gap-2">
              <button
                disabled={pending}
                className={`${btn} bg-emerald-600 text-white`}
                onClick={() =>
                  run(
                    start,
                    async () => {
                      await saveProcess(p.id, { title, body, changeNote });
                      setEditing(false);
                    },
                    "Processo salvo."
                  )
                }
              >
                Salvar
              </button>
              <button className={`${btn} bg-slate-100 dark:bg-slate-800`} onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-200">{p.body}</div>
        )}
      </article>

      <section className={card} aria-label="Tirar dúvida">
        <h3 className="font-semibold">Tirar dúvida</h3>
        <p className="text-xs text-slate-500">A IA responde pelo texto deste processo. Se não estiver aqui, a dúvida vai para a gestão.</p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              start,
              async () => {
                const r = await askProcess(p.id, question);
                setAnswer(r.text);
                if (r.answered) setQuestion("");
              },
              ""
            );
          }}
        >
          <input className={input} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex.: o que faço se o paciente não confirmar?" />
          <button disabled={pending || question.trim().length < 5} className={`${btn} bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900`}>
            Perguntar
          </button>
        </form>
        {answer && <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm">{answer}</p>}
      </section>

      <section className={card} aria-label="Opinião ou reclamação">
        <h3 className="font-semibold">Opinião ou reclamação</h3>
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              start,
              async () => {
                await sendProcessFeedback(p.id, { kind, text, anonymous });
                setText("");
              },
              "Enviado para a gestão."
            );
          }}
        >
          <div className="flex flex-wrap gap-3 text-sm">
            {(["OPINIAO", "RECLAMACAO", "DUVIDA"] as FeedbackKind[]).map((k) => (
              <label key={k} className="inline-flex items-center gap-1.5">
                <input type="radio" name={`kind-${p.id}`} checked={kind === k} onChange={() => setKind(k)} className="accent-emerald-600" />
                {FEEDBACK_LABELS[k]}
              </label>
            ))}
          </div>
          <textarea className={`${input} min-h-24`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva aqui" maxLength={2000} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              Enviar sem meu nome
            </label>
            <button disabled={pending || text.trim().length < 5} className={`${btn} bg-emerald-600 text-white`}>
              Enviar
            </button>
          </div>
          {anonymous && <p className="text-xs text-slate-500">Sem nome, a resposta da gestão não aparece em “Minhas mensagens”.</p>}
        </form>
      </section>
    </div>
  );
}

function FeedbackList({ rows, manage = false }: { rows: Feedback[]; manage?: boolean }) {
  const [pending, start] = useTransition();
  const [replies, setReplies] = useState<Record<string, string>>({});
  if (rows.length === 0) return <p className={`${card} text-sm text-slate-600 dark:text-slate-400`}>Nenhuma mensagem ainda.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((f) => (
        <li key={f.id} className={card}>
          <p className="text-xs text-slate-500">
            {FEEDBACK_LABELS[f.kind as FeedbackKind] ?? f.kind} · {f.process.title} · {fmt.format(new Date(f.createdAt))}
            {f.author ? ` · ${f.author}` : ""} ·{" "}
            <span className={f.status === "NOVA" ? "font-semibold text-amber-700 dark:text-amber-300" : ""}>{STATUS_LABEL[f.status] ?? f.status}</span>
          </p>
          <p className="mt-1 whitespace-pre-line text-sm">{f.text}</p>
          {f.aiAnswer && <p className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-sm">IA: {f.aiAnswer}</p>}
          {f.managerReply && !manage && <p className="mt-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2 text-sm">Gestão: {f.managerReply}</p>}
          {manage && (
            <div className="mt-3 space-y-2">
              <textarea
                className={`${input} min-h-16`}
                placeholder="Resposta (opcional — aparece para quem mandou)"
                defaultValue={f.managerReply ?? ""}
                onChange={(e) => setReplies((r) => ({ ...r, [f.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                {(["VISTA", "RESOLVIDA"] as const).map((s) => (
                  <button
                    key={s}
                    disabled={pending}
                    className={`${btn} ${s === "RESOLVIDA" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
                    onClick={() =>
                      run(start, () => updateProcessFeedback(f.id, { status: s, managerReply: replies[f.id] ?? f.managerReply ?? "" }), "Atualizado.")
                    }
                  >
                    Marcar como {STATUS_LABEL[s].toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

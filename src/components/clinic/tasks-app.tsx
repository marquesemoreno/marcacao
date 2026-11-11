"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Check, Loader2, MessageCircle, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/clinic/page-header";
import { createTask, deleteTask, getTaskPatient, listTaskAssignees, listTasks, setTaskDone, type TaskView } from "@/actions/reception-tasks";
import { TASK_TEXT_MAX, groupTasks, validateTaskInput, type TaskBucket } from "@/lib/reception-tasks";

const field =
  "h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";
const primaryBtn = "inline-flex h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60";
const secondaryBtn =
  "inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60";

const GROUP_TITLE: Record<TaskBucket, string> = { OVERDUE: "Atrasadas", TODAY: "Para hoje", UPCOMING: "Próximas", DONE: "Concluídas" };
const dueFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

type Assignees = { me: string; users: { id: string; name: string }[] };

function NewTaskForm({ assignees, patient, onDone }: { assignees: Assignees; patient: { conversationId: string; name: string } | null; onDone: (saved: boolean) => void }) {
  const uid = useId();
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedUserId, setAssignedUserId] = useState(assignees.me);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const error = validateTaskInput({ text, dueDate: dueDate || null });

  async function save() {
    setTried(true);
    if (error) return;
    setSaving(true);
    try {
      const r = await createTask({ text, dueDate: dueDate || null, assignedUserId: assignedUserId || null, conversationId: patient?.conversationId ?? null });
      if (r.success) {
        toast.success("Tarefa criada.");
        onDone(true);
      } else toast.error(r.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-surface space-y-4 p-4 sm:p-5" aria-label="Nova tarefa">
      {patient && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 px-3 py-1 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          <MessageCircle className="h-4 w-4" aria-hidden /> Paciente: {patient.name}
        </p>
      )}
      <div>
        <label htmlFor={`${uid}-text`} className={labelClass}>
          O que precisa ser feito
        </label>
        <textarea
          id={`${uid}-text`}
          rows={2}
          maxLength={TASK_TEXT_MAX}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex.: Cobrar a autorização do convênio e avisar o paciente."
          className={`${field} mt-1 h-auto py-2`}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-due`} className={labelClass}>
            Prazo (opcional)
          </label>
          <input id={`${uid}-due`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${field} mt-1`} />
        </div>
        <div>
          <label htmlFor={`${uid}-who`} className={labelClass}>
            Responsável
          </label>
          <select id={`${uid}-who`} value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className={`${field} mt-1`}>
            <option value="">Sem responsável (toda a equipe vê)</option>
            {assignees.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.id === assignees.me ? " (eu)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      {tried && error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onDone(false)} disabled={saving} className={secondaryBtn}>
          Cancelar
        </button>
        <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Criar tarefa
        </button>
      </div>
    </section>
  );
}

function TaskRow({ task, bucket, onChanged }: { task: TaskView; bucket: TaskBucket; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(action: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(true);
    try {
      const r = await action();
      if (r.success) {
        toast.success(ok);
        onChanged();
      } else toast.error(r.error ?? "Não foi possível salvar.");
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const due = task.dueAt ? dueFmt.format(new Date(task.dueAt)) : null;
  return (
    <li className="flex items-start gap-3 py-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => setTaskDone(task.id, !task.done), task.done ? "Tarefa reaberta." : "Tarefa concluída.")}
        aria-label={task.done ? `Reabrir: ${task.text}` : `Concluir: ${task.text}`}
        className={`mt-0.5 flex size-11 sm:size-7 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-60 ${
          task.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-500 hover:text-emerald-600"
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden /> : task.done ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm whitespace-pre-wrap break-words ${task.done ? "text-slate-500 line-through" : "text-slate-900 dark:text-slate-100"}`}>{task.text}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {due && (
            <span className={bucket === "OVERDUE" ? "font-semibold text-red-700 dark:text-red-300" : bucket === "TODAY" ? "font-semibold text-amber-700 dark:text-amber-300" : ""}>
              {bucket === "OVERDUE" ? `Venceu em ${due}` : bucket === "TODAY" ? "Vence hoje" : `Prazo ${due}`}
            </span>
          )}
          <span>{task.assigneeName ?? "Sem responsável"}</span>
          {task.conversationId && task.patientName && (
            <Link href={`/clinic/inbox?c=${task.conversationId}`} prefetch={false} className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300 underline underline-offset-2">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {task.patientName}
            </Link>
          )}
          {task.source ? (
            <span className="inline-flex items-center gap-1">
              <Bot className="h-3.5 w-3.5" aria-hidden /> Automação: {task.source}
            </span>
          ) : (
            task.createdByName && <span>Criada por {task.createdByName}</span>
          )}
        </p>
      </div>
      {confirmDelete ? (
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className="h-9 rounded-lg px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
            Manter
          </button>
          <button type="button" onClick={() => run(() => deleteTask(task.id), "Tarefa excluída.")} disabled={busy} className="h-9 rounded-lg bg-red-600 px-2 text-xs font-semibold text-white hover:bg-red-700">
            Excluir
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
          aria-label={`Excluir: ${task.text}`}
          className="flex size-11 sm:size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-700 dark:hover:bg-slate-800"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}
    </li>
  );
}

export function TasksApp({ conversationId }: { conversationId: string | null }) {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [showDone, setShowDone] = useState(false);
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [assignees, setAssignees] = useState<Assignees | null>(null);
  const [patient, setPatient] = useState<{ conversationId: string; name: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    listTasks({ scope, includeDone: showDone })
      .then(setTasks)
      .catch(() => setLoadError(true));
  }, [scope, showDone]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    listTaskAssignees()
      .then(setAssignees)
      .catch(() => {});
  }, []);
  // Atalho "Criar tarefa" do Chat: chega com ?c=<conversa> e já abre o formulário com o paciente.
  useEffect(() => {
    if (!conversationId) return;
    getTaskPatient(conversationId)
      .then((p) => {
        if (!p) return;
        setPatient(p);
        setFormOpen(true);
      })
      .catch(() => {});
  }, [conversationId]);

  const groups = useMemo(() => {
    const now = new Date();
    return groupTasks(
      (tasks ?? []).map((t) => ({ ...t, dueAt: t.dueAt ? new Date(t.dueAt) : null })),
      now,
    );
  }, [tasks]);
  const byId = useMemo(() => new Map((tasks ?? []).map((t) => [t.id, t])), [tasks]);
  const openCount = groups.OVERDUE.length + groups.TODAY.length + groups.UPCOMING.length;
  const order: TaskBucket[] = showDone ? ["OVERDUE", "TODAY", "UPCOMING", "DONE"] : ["OVERDUE", "TODAY", "UPCOMING"];

  return (
    <div className="h-full overflow-y-auto soft-canvas">
      <div className="space-y-5 p-4 sm:p-6 max-w-3xl">
        <PageHeader
          title="Tarefas"
          subtitle={tasks ? `${openCount} em aberto${groups.OVERDUE.length ? ` · ${groups.OVERDUE.length} ${groups.OVERDUE.length === 1 ? "atrasada" : "atrasadas"}` : ""}` : "O que a recepção precisa fazer, com prazo e responsável."}
          actions={
            !formOpen && (
              <button type="button" onClick={() => setFormOpen(true)} disabled={!assignees} className={primaryBtn}>
                <Plus className="h-4 w-4" aria-hidden /> Nova tarefa
              </button>
            )
          }
        />

        {formOpen && assignees && (
          <NewTaskForm
            assignees={assignees}
            patient={patient}
            onDone={(saved) => {
              setFormOpen(false);
              setPatient(null);
              if (saved) load();
            }}
          />
        )}
        {patient && !formOpen && (
          <button type="button" onClick={() => setPatient(null)} className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
            <X className="h-3.5 w-3.5" aria-hidden /> Tirar o paciente da próxima tarefa
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="De quem" className="inline-flex rounded-full bg-white/70 dark:bg-white/[0.08] p-1 ring-1 ring-slate-900/5 dark:ring-white/10">
            {(
              [
                ["mine", "Minhas e sem responsável"],
                ["all", "Da equipe toda"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={scope === value}
                onClick={() => setScope(value)}
                className={`h-9 rounded-full px-3.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                  scope === value ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="inline-flex h-9 items-center gap-2 px-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />
            Mostrar concluídas
          </label>
        </div>

        {loadError ? (
          <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            Não foi possível carregar as tarefas.{" "}
            <button type="button" onClick={load} className="font-semibold underline underline-offset-2">
              Tentar de novo
            </button>
          </div>
        ) : !tasks ? (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando as tarefas…
          </p>
        ) : tasks.length === 0 ? (
          <div className="glass-surface p-6 text-sm text-slate-600 dark:text-slate-400">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Nenhuma tarefa {scope === "mine" ? "para você" : "na equipe"}.</p>
            <p className="mt-1">
              Crie uma em “Nova tarefa”, pelo menu de ações de uma conversa no Chat, ou deixe uma automação criar (Disparos › Configurar › Automações, ação “Criar tarefa para a
              recepção”).
            </p>
          </div>
        ) : (
          order
            .filter((bucket) => groups[bucket].length > 0)
            .map((bucket) => (
              <section key={bucket} className="glass-surface px-4 py-3 sm:px-5" aria-label={GROUP_TITLE[bucket]}>
                <h2 className={`text-sm font-semibold ${bucket === "OVERDUE" ? "text-red-700 dark:text-red-300" : "text-slate-900 dark:text-slate-100"}`}>
                  {GROUP_TITLE[bucket]} <span className="font-normal text-slate-600 dark:text-slate-400">({groups[bucket].length})</span>
                </h2>
                <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {groups[bucket].map((t) => (
                    <TaskRow key={t.id} task={byId.get(t.id)!} bucket={bucket} onChanged={load} />
                  ))}
                </ul>
              </section>
            ))
        )}
      </div>
    </div>
  );
}

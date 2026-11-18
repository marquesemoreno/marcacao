"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/clinic/page-header";
import { getWaitingBoard, setUnansweredReturnMinutes, type WaitingRow } from "@/actions/waiting-board";
import { RETURN_MINUTE_OPTIONS } from "@/lib/queue-return";

type Board = Awaited<ReturnType<typeof getWaitingBoard>>;

const REFRESH_MS = 60_000;

/** "há 5 min", "há 2 h 10 min", "há 3 dias" — tempo de relógio, não só horário comercial. */
function sinceLabel(iso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `há ${h} h ${min % 60} min` : `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

export function WaitingBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await getWaitingBoard());
      setNow(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  async function changeMinutes(value: string) {
    setSaving(true);
    try {
      const minutes = value ? Number(value) : null;
      await setUnansweredReturnMinutes(minutes);
      toast.success(minutes ? `Sem resposta em ${minutes} min úteis, a conversa volta para Não Atribuídas.` : "Volta à fila desligada.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const subtitle = board
    ? `${board.waiting.length} esperando · ${board.inService.length} em atendimento · ${board.resolvedToday} finalizadas hoje`
    : undefined;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="Esperando" subtitle={subtitle} />

      {board?.canConfigure && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Volta à fila</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Conversa com dono e paciente sem resposta volta para Não Atribuídas, com uma nota dizendo quem não respondeu. Conta só o horário
              comercial, no máximo 2 vezes seguidas.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Prazo da volta à fila</span>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />}
            <select
              value={board.returnMinutes ?? ""}
              disabled={saving}
              onChange={(e) => changeMinutes(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
            >
              <option value="">Desligado</option>
              {RETURN_MINUTE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  Depois de {m} min
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      {!board && !error && <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Carregando" />}

      {board && (
        <div className="grid gap-4 md:grid-cols-2">
          <Column title="Aguardando resposta" empty="Ninguém esperando agora." rows={board.waiting} now={now} showSince />
          <Column title="Em atendimento" empty="Nenhuma conversa em atendimento." rows={board.inService} now={now} />
        </div>
      )}
    </div>
  );
}

function Column({ title, empty, rows, now, showSince }: { title: string; empty: string; rows: WaitingRow[]; now: number; showSince?: boolean }) {
  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h2 className="font-semibold">
        {title} <span className="text-sm font-normal text-slate-500 tabular-nums">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/clinic/inbox?c=${r.id}`}
                prefetch={false}
                className="flex items-center justify-between gap-3 rounded py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-slate-500">{r.assigneeName ?? "Sem dono"}</span>
                </span>
                {showSince && r.since && (
                  <span className="shrink-0 text-sm tabular-nums text-amber-800 dark:text-amber-300">{sinceLabel(r.since, now)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

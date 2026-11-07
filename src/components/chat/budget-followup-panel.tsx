"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleDollarSign, ChevronDown, ChevronUp, Send, MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  listBudgetFollowups,
  sendBudgetFollowup,
  skipBudgetFollowup,
  type BudgetFollowupItem,
} from "@/actions/budget-followup";

const STEP_LABEL = ["", "1ª cobrança", "2ª cobrança", "Última cobrança"];

/** Fila de cobrança de orçamentos (3, 7 e 15 dias) no topo do CRM. A recepção revisa o
 * texto e envia; nada sai sozinho. Some quando não há nada vencido. */
export function BudgetFollowupPanel({ onOpenChat }: { onOpenChat: (conversationId: string) => void }) {
  const [items, setItems] = useState<BudgetFollowupItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listBudgetFollowups()
      .then((r) => setItems(r.due))
      .catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  if (!items || items.length === 0) return null;
  const total = items.reduce((s, i) => s + (i.value ?? 0), 0);

  const remove = (id: string) => setItems((prev) => (prev ?? []).filter((i) => i.conversationId !== id));

  async function send(item: BudgetFollowupItem) {
    setBusy(item.conversationId);
    const r = await sendBudgetFollowup(item.conversationId, item.step, drafts[item.conversationId] ?? item.message).catch(
      () => ({ ok: false, error: "Não foi possível enviar." }),
    );
    setBusy(null);
    if (!r.ok) return void toast.error(r.error ?? "Não foi possível enviar.");
    toast.success(`Cobrança enviada para ${item.name.split(" ")[0]}.`);
    remove(item.conversationId);
  }

  async function skip(item: BudgetFollowupItem) {
    setBusy(item.conversationId);
    await skipBudgetFollowup(item.conversationId, item.step).catch(() => null);
    setBusy(null);
    remove(item.conversationId);
  }

  return (
    <div className="shrink-0 border-b border-violet-200 dark:border-violet-900/60 bg-violet-50/80 dark:bg-violet-950/30 px-4 sm:px-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-2.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 rounded-md"
      >
        <CircleDollarSign className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
        <span className="font-semibold">
          {items.length} orçamento{items.length === 1 ? "" : "s"} para cobrar
        </span>
        {total > 0 && (
          <span className="text-slate-600 dark:text-slate-400 tabular-nums">· {formatCurrency(total)} em aberto</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300">
          {open ? "Fechar" : "Ver e enviar"}
          {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </span>
      </button>

      {open && (
        <ul className="max-h-[45vh] overflow-y-auto pb-3 space-y-2">
          {items.map((item) => {
            const id = item.conversationId;
            const disabled = busy === id;
            return (
              <li key={id} className="rounded-xl bg-white dark:bg-slate-900 shadow-xs p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold">{item.name}</span>
                  {item.value != null && (
                    <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(item.value)}</span>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Orçamento há {item.daysSince} dia{item.daysSince === 1 ? "" : "s"} · {STEP_LABEL[item.step]}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenChat(id)}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Abrir conversa
                  </button>
                </div>
                <textarea
                  aria-label={`Mensagem para ${item.name}`}
                  value={drafts[id] ?? item.message}
                  onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                  rows={2}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => skip(item)}
                    title="Não envia agora; volta na próxima etapa"
                    className="h-8 px-3 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    Pular
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => send(item)}
                    className="h-8 px-3 rounded-md inline-flex items-center gap-1.5 bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden /> {disabled ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

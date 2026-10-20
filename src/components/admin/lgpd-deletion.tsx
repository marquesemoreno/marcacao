"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { anonymizePatientAdmin, findPatientForDeletion, type listDeletionRecords } from "@/actions/admin-lgpd";

type Found = Awaited<ReturnType<typeof findPatientForDeletion>>;
type Rec = Awaited<ReturnType<typeof listDeletionRecords>>[number];

/** /admin/lgpd — atende pedido de exclusão do titular (chega pelo e-mail da página
 * /exclusao-de-dados): busca pelo telefone, escolhe a clínica e confirma. */
export function LgpdDeletion({ records }: { records: Rec[] }) {
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<Found>(null);
  const [searched, setSearched] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

  function search() {
    start(async () => {
      setFound(await findPatientForDeletion(phone));
      setSearched(true);
      setTarget(null);
    });
  }

  function run() {
    if (!target) return;
    start(async () => {
      const r = await anonymizePatientAdmin({ conversationId: target, reason, confirm });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `${r.messagesDeleted} mensagem(ns) apagada(s).` +
          (r.contactAnonymized
            ? " Nome e telefone anonimizados."
            : ` O paciente ainda conversa com ${r.otherConversations} outra(s) clínica(s): nome e telefone continuam lá.`),
        { duration: 10000 }
      );
      setTarget(null);
      setReason("");
      setConfirm("");
      setFound(await findPatientForDeletion(phone));
    });
  }

  const input = "h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-6 p-4 sm:p-6 max-w-4xl">
        <div>
          <h1 className="text-xl font-semibold">Exclusão de dados (LGPD)</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Para pedidos de exclusão do titular. Apaga mensagens, mídias e o cadastro do paciente na clínica escolhida. Agendamentos ficam guardados
            (registro clínico). A ação não pode ser desfeita.
          </p>
        </div>

        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Telefone do titular (com DDD)
            <span className="mt-1 flex gap-2">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="77999998888" className={`${input} w-56`} />
              <button
                type="button"
                onClick={search}
                disabled={pending || phone.replace(/\D/g, "").length < 10}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 dark:bg-slate-100 px-3 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-50"
              >
                <Search className="h-4 w-4" aria-hidden /> Buscar
              </button>
            </span>
          </label>

          {searched && !found && <p className="text-sm text-slate-600 dark:text-slate-400">Nenhum paciente com esse telefone.</p>}
          {found && (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-semibold">{found.name}</span> · conversa com {found.conversations.length} clínica(s)
              </p>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-800">
                {found.conversations.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      {c.clinic} <span className="text-xs text-slate-500">· {c.messages} mensagens</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTarget(c.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir dados nesta clínica
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {target && (
            <div className="space-y-2 rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 p-3">
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">Confirmar exclusão</p>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Registro do pedido (de onde veio, data)
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="E-mail do titular em 20/10/2026" className={`${input} mt-1 w-full`} />
              </label>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Digite EXCLUIR para confirmar
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${input} mt-1 w-40`} />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setTarget(null)} disabled={pending} className="h-9 rounded-md border border-slate-300 dark:border-slate-600 px-3 text-sm font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={run}
                  disabled={pending || confirm !== "EXCLUIR" || reason.trim().length < 5}
                  className="h-9 rounded-md bg-rose-600 hover:bg-rose-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Excluir definitivamente
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Exclusões feitas</h2>
          {records.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Nenhuma ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm">
              {records.map((r) => (
                <li key={r.id} className="px-4 py-2">
                  <span className="tabular-nums text-slate-500">{fmt.format(new Date(r.createdAt))}</span> · {r.clinic} · {r.maskedPhone ?? "sem telefone"} ·{" "}
                  {r.messagesDeleted} mensagens{r.contactAnonymized ? " · contato anonimizado" : ""}
                  <span className="block text-xs text-slate-500">{r.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

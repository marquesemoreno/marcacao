"use client";

import { useState, useTransition } from "react";
import { Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { addQueueService, updateQueueService } from "@/actions/queue-ticket";
import type { QueueServiceView } from "@/lib/queue-ticket-server";

const input = "h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";

/** Serviços das senhas do totem (Consulta, Exame, Resultado…): nome, letra, ativo. */
export function QueueServicesSettings({ initial }: { initial: QueueServiceView[] }) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [letter, setLetter] = useState("");
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<QueueServiceView[]>, ok?: string) =>
    start(async () => {
      try {
        setItems(await fn());
        if (ok) toast.success(ok);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não deu certo.");
      }
    });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-labelledby="queue-services">
      <h2 id="queue-services" className="flex items-center gap-2 text-sm font-semibold">
        <Ticket className="h-4 w-4 text-emerald-600" aria-hidden /> Serviços das senhas
      </h2>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        No totem o paciente escolhe o serviço e depois Normal ou Preferencial. A senha leva a letra do serviço: C001 (normal), CP001 (preferencial). Desativado some do totem.
      </p>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((sv) => (
          <li key={sv.id} className={`flex items-center gap-3 py-2 text-sm ${sv.active ? "" : "opacity-50"}`}>
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-slate-100 font-mono font-bold dark:bg-slate-800">{sv.letter}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{sv.name}</span>
            <span className="text-xs text-slate-500 tabular-nums">{sv.letter}001 · {sv.letter}P001</span>
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input type="checkbox" className="size-4 accent-emerald-600" checked={sv.active} disabled={pending} onChange={(e) => act(() => updateQueueService(sv.id, { active: e.target.checked }))} />
              Ativo
            </label>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          act(async () => {
            const r = await addQueueService({ name, letter });
            setName("");
            setLetter("");
            return r;
          }, "Serviço adicionado");
        }}
      >
        <label className="sr-only" htmlFor="qs-name">Nome do serviço</label>
        <input id="qs-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Vacina" maxLength={30} className={`${input} min-w-0 flex-1`} />
        <label className="sr-only" htmlFor="qs-letter">Letra</label>
        <input id="qs-letter" value={letter} onChange={(e) => setLetter(e.target.value.toUpperCase().slice(0, 1))} placeholder="Letra" className={`${input} w-20 text-center font-mono`} />
        <button type="submit" disabled={pending || !name.trim() || !letter} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden /> Adicionar
        </button>
      </form>
    </section>
  );
}

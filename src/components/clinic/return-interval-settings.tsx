"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { saveReturnInterval, type getReturnIntervalSettings } from "@/actions/return-intervals";
import { validateReturnDays } from "@/lib/return-interval";
import { toTitleCase } from "@/lib/agenda-ui";

type Settings = Awaited<ReturnType<typeof getReturnIntervalSettings>>;
type Kind = "DOCTOR" | "PROCEDURE";

/** Dias de retorno por médico e por procedimento. Vazio = padrão da régua. Salva ao sair do campo. */
export function ReturnIntervalSettings({ initial }: { initial: Settings }) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-700 dark:text-slate-300">
        Padrão: <strong className="tabular-nums">{initial.fallback} dias</strong> (passo Retorno da régua, em Disparos). Quando a consulta tem
        procedimento configurado, ele vale primeiro; senão, o do médico; senão, o padrão.
      </p>
      <DoctorSection rows={initial.doctors} fallback={initial.fallback} />
      <Section
        title="Por procedimento"
        hint="Procedimentos cadastrados no Conecta. Valem para as marcações feitas pelo Conecta."
        empty="Nenhum procedimento cadastrado no Conecta."
        kind="PROCEDURE"
        rows={initial.procedures}
        fallback={initial.fallback}
      />
    </div>
  );
}

function Section({ title, hint, empty, kind, rows, fallback }: { title: string; hint: string; empty: string; kind: Kind; rows: Settings["procedures"]; fallback: number }) {
  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => (
            <DaysRow key={r.key} kind={kind} row={r} fallback={fallback} />
          ))}
        </ul>
      )}
    </section>
  );
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Médicos ativos (com pacientes no último ano ou já configurados) primeiro; o resto do
 * cadastro do sistema (faturamento, convênios…) fica em "Ver todos". Busca por nome. */
function DoctorSection({ rows, fallback }: { rows: Settings["doctors"]; fallback: number }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const q = norm(query.trim());
  const hidden = rows.filter((r) => !r.active).length;
  const visible = q ? rows.filter((r) => norm(r.label).includes(q)) : showAll ? rows : rows.filter((r) => r.active);
  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h2 className="font-semibold">Por médico</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Médicos do sistema da clínica. É o que vale na régua (pela última consulta do paciente). Primeiro, quem atendeu no último ano.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Sem lista de médicos — o sistema da clínica não está conectado ou não respondeu.</p>
      ) : (
        <>
          <label className="relative mt-3 block">
            <span className="sr-only">Buscar médico</span>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar médico pelo nome"
              className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            />
          </label>
          {visible.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nenhum médico com “{query.trim()}”.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((r) => (
                <DaysRow key={r.key} kind="DOCTOR" row={r} fallback={fallback} detail={r.patients > 0 ? `${r.patients} ${r.patients === 1 ? "paciente" : "pacientes"}` : undefined} />
              ))}
            </ul>
          )}
          {!q && hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded"
            >
              {showAll ? "Mostrar só os ativos" : `Ver todos (+${hidden} sem pacientes no último ano)`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function DaysRow({ kind, row, fallback, detail }: { kind: Kind; row: { key: string; label: string; days: number | null }; fallback: number; detail?: string }) {
  const [value, setValue] = useState(row.days === null ? "" : String(row.days));
  const [saved, setSaved] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    const v = value.trim();
    if (v === saved) return;
    const days = v === "" ? null : Number(v);
    const invalid = days === null ? null : validateReturnDays(days);
    if (invalid) return setError(invalid);
    setError(null);
    setSaving(true);
    try {
      await saveReturnInterval({ kind, key: row.key, label: row.label, days });
      setSaved(v);
      toast.success(days === null ? `${toTitleCase(row.label)}: volta ao padrão` : `${toTitleCase(row.label)}: retorno em ${days} dias`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const id = `ret-${kind}-${row.key}`;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <label htmlFor={id} className="min-w-0 flex-1 text-sm font-medium">
        {toTitleCase(row.label)}
        {detail && <span className="ml-2 text-xs font-normal text-slate-500 tabular-nums">{detail}</span>}
      </label>
      <div className="flex items-center gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />}
        <input
          id={id}
          inputMode="numeric"
          value={value}
          placeholder={String(fallback)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          className="h-9 w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-right text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 aria-[invalid=true]:border-red-400"
        />
        <span className="text-sm text-slate-500">dias</span>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="w-full text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </li>
  );
}

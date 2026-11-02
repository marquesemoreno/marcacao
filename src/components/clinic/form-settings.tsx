"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { saveFormTemplate, type getFormSettings } from "@/actions/patient-forms";
import type { FormQuestion } from "@/lib/patient-form";

type Settings = Awaited<ReturnType<typeof getFormSettings>>;

const input =
  "h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";
const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";
const TYPE_LABEL: Record<FormQuestion["type"], string> = { text: "Texto", yesno: "Sim / Não", choice: "Escolha" };

function slug(label: string, taken: Set<string>) {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 30) || "pergunta";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  return id;
}

/** Configuração da ficha prévia (gestão): liga/desliga, edita perguntas, mostra o termo. */
export function FormSettings({ initial }: { initial: Settings }) {
  const [active, setActive] = useState(initial.active);
  const [questions, setQuestions] = useState<FormQuestion[]>(initial.questions);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const update = (i: number, patch: Partial<FormQuestion>) => {
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setQuestions((qs) => {
      const next = [...qs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
    setDirty(true);
  };

  async function save(nextActive = active) {
    setSaving(true);
    try {
      // id estável a partir do texto (respostas antigas guardam a versão que o paciente viu).
      const taken = new Set<string>();
      const clean = questions.map((q) => {
        const id = q.id || slug(q.label, taken);
        taken.add(id);
        return { ...q, id, options: q.type === "choice" ? (q.options ?? []).filter((o) => o.trim()) : undefined };
      });
      await saveFormTemplate({ questions: clean, active: nextActive });
      setActive(nextActive);
      setQuestions(clean);
      setDirty(false);
      toast.success(nextActive ? "Ficha salva — vai junto com os próximos lembretes." : "Ficha salva (desligada).");
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes("Acesso") ? e.message : "Confira as perguntas: todas precisam de texto e as de escolha, de 2 opções.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{active ? "Ligada" : "Desligada"}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {active
              ? "O link vai no lembrete da véspera (WhatsApp não oficial). No modelo da API oficial, ainda não."
              : "Ligue para mandar o link da ficha junto com o lembrete da véspera."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          disabled={saving}
          onClick={() => save(!active)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${active ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"}`}
        >
          <span className="sr-only">Ficha prévia ligada</span>
          <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="font-semibold">Perguntas</h2>
        {initial.isDefault && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Modelo sugerido — ajuste à vontade antes de ligar.</p>}
        <ol className="mt-3 space-y-3">
          {questions.map((q, i) => (
            <li key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex flex-wrap items-start gap-2">
                <input
                  aria-label={`Pergunta ${i + 1}`}
                  value={q.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  className={`${input} min-w-[12rem] flex-1`}
                />
                <select
                  aria-label={`Tipo da pergunta ${i + 1}`}
                  value={q.type}
                  onChange={(e) => update(i, { type: e.target.value as FormQuestion["type"], options: e.target.value === "choice" ? q.options ?? ["", ""] : undefined })}
                  className={`${input} w-auto`}
                >
                  {Object.entries(TYPE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <div className="flex">
                  <button type="button" className={iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className={iconBtn} onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Descer">
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={questions.length === 1}
                    aria-label="Remover pergunta"
                    onClick={() => {
                      setQuestions((qs) => qs.filter((_, j) => j !== i).map((x) => (x.showIf?.id === q.id ? { ...x, showIf: undefined } : x)));
                      setDirty(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              {q.type === "choice" && (
                <input
                  aria-label={`Opções da pergunta ${i + 1}, separadas por vírgula`}
                  placeholder="Opções separadas por vírgula"
                  value={(q.options ?? []).join(", ")}
                  onChange={(e) => update(i, { options: e.target.value.split(",").map((o) => o.trim()) })}
                  className={`${input} mt-2`}
                />
              )}
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                Obrigatória
              </label>
              {q.showIf && (
                <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">
                  Só aparece se “{questions.find((x) => x.id === q.showIf!.id)?.label ?? "?"}” = {q.showIf.equals}
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setQuestions((qs) => [...qs, { id: "", label: "", type: "text", required: false }]);
              setDirty(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <Plus className="h-4 w-4" aria-hidden /> Pergunta
          </button>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => save()}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Salvar perguntas
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Cada salvamento vira uma nova versão — fichas já enviadas continuam com as perguntas que o paciente viu. Não peça CPF nem documentos aqui.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="font-semibold">
          Termo que o paciente aceita <span className="text-sm font-normal text-slate-500">(versão {initial.term.version})</span>
        </h2>
        {initial.term.isDefault && (
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">Termo padrão do Conecta (rascunho) — em revisão jurídica.</p>
        )}
        <p className="mt-2 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{initial.term.body.replaceAll("{{clinica}}", "sua clínica")}</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">As respostas ficam guardadas por 1 ano e são apagadas automaticamente.</p>
      </section>
    </div>
  );
}

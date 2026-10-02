"use client";

import { useEffect, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { previewBridgeAudience, getCampaignExclusions, setCampaignExclusions, type BridgeAudienceFilters } from "@/actions/clinic-broadcast";
import type { ParsedBroadcastRecipient } from "@/lib/broadcast-csv";

type Preview = Awaited<ReturnType<typeof previewBridgeAudience>>;

const selectClass =
  "w-full mt-1 h-8 px-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100";

/** Público da campanha direto do sistema da clínica (Firebird via bridge) — alternativa
 * ao CSV. A prévia consulta na hora e entrega os destinatários prontos pro formulário. */
export function BridgeAudiencePicker({ onRecipients }: { onRecipients: (r: ParsedBroadcastRecipient[]) => void }) {
  const [sexo, setSexo] = useState<"" | "F" | "M">("F");
  const [months, setMonths] = useState(12);
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [exclusions, setExclusions] = useState("");
  const [savedExclusions, setSavedExclusions] = useState("");
  const [savingExclusions, setSavingExclusions] = useState(false);

  useEffect(() => {
    getCampaignExclusions()
      .then((ids) => {
        const text = ids.join(", ");
        setExclusions(text);
        setSavedExclusions(text);
      })
      .catch(() => {});
  }, []);

  async function handleSaveExclusions() {
    setSavingExclusions(true);
    try {
      const count = await setCampaignExclusions(exclusions);
      setSavedExclusions(exclusions);
      toast.success(`Lista de exclusão salva (${count} paciente(s)).`);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a lista.");
    } finally {
      setSavingExclusions(false);
    }
  }

  function invalidate() {
    setPreview(null);
    onRecipients([]);
  }

  async function handlePreview() {
    setLoading(true);
    try {
      const filters: BridgeAudienceFilters = {
        sexo: sexo || undefined,
        months,
        minAge: minAge ? Number(minAge) : undefined,
        maxAge: maxAge ? Number(maxAge) : undefined,
      };
      const result = await previewBridgeAudience(filters);
      setPreview(result);
      onRecipients(result.recipients);
    } catch (error) {
      invalidate();
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o sistema da clínica.");
    } finally {
      setLoading(false);
    }
  }

  const s = preview?.stats;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
          Sexo
          <select value={sexo} onChange={(e) => { setSexo(e.target.value as "" | "F" | "M"); invalidate(); }} className={selectClass}>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
          Última marcação
          <select value={months} onChange={(e) => { setMonths(Number(e.target.value)); invalidate(); }} className={selectClass}>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
            <option value={24}>Últimos 24 meses</option>
          </select>
        </label>
        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
          Idade mínima
          <input type="number" min={0} max={120} value={minAge} onChange={(e) => { setMinAge(e.target.value); invalidate(); }} className={selectClass} />
        </label>
        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
          Idade máxima
          <input type="number" min={0} max={120} value={maxAge} placeholder="—" onChange={(e) => { setMaxAge(e.target.value); invalidate(); }} className={selectClass} />
        </label>
      </div>

      <div>
        <label htmlFor="campaign-exclusions" className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
          Lista de exclusão — códigos de paciente do sistema da clínica que nunca recebem campanha
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="campaign-exclusions"
            value={exclusions}
            onChange={(e) => setExclusions(e.target.value)}
            placeholder="Ex.: 9982, 11704"
            className="flex-1 h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            disabled={savingExclusions || exclusions === savedExclusions}
            onClick={handleSaveExclusions}
            className="px-3 h-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            {savingExclusions ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handlePreview}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 rounded-lg disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
        {loading ? "Consultando o sistema da clínica..." : "Ver prévia"}
      </button>

      {s && preview && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {s.recipients} destinatário(s) — de {s.total} paciente(s) encontrados no sistema.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
            <li>Na lista de exclusão: <strong>{s.excludedManual}</strong></li>
            <li>Fora pela idade: <strong>{s.excludedAge}</strong></li>
            <li>Sem data de nascimento (fora): <strong>{s.excludedNoBirthDate}</strong></li>
            <li>Telefone inválido: <strong>{s.invalidPhone}</strong></li>
            <li>Pediram para não receber (9): <strong>{s.optedOut}</strong></li>
            <li>Número compartilhado (vai sem nome): <strong>{s.sharedPhones}</strong></li>
          </ul>
          {preview.sample.length > 0 && (
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
              <p className="font-medium mb-0.5">Amostra:</p>
              <ul className="font-mono space-y-0.5">
                {preview.sample.map((r, i) => (
                  <li key={i}>{r.phone} — “{r.saudacao}”</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

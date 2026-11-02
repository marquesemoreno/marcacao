"use client";

import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { previewBridgeAudience, type BridgeAudienceFilters } from "@/actions/clinic-broadcast";
import type { ParsedBroadcastRecipient } from "@/lib/broadcast-csv";

type Preview = Awaited<ReturnType<typeof previewBridgeAudience>>;

const selectClass =
  "w-full mt-1 h-9 px-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100";

/** Público da campanha direto do sistema da clínica (Firebird via bridge) — alternativa
 * ao CSV. A prévia consulta na hora e entrega os destinatários prontos pro formulário. */
export function BridgeAudiencePicker({ onRecipients }: { onRecipients: (r: ParsedBroadcastRecipient[]) => void }) {
  const [kind, setKind] = useState<"recentes" | "retorno">("recentes");
  const [range, setRange] = useState("6-12");
  const [sexo, setSexo] = useState<"" | "F" | "M">("");
  const [months, setMonths] = useState(12);
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
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
        retorno: kind === "retorno" ? { minMonths: Number(range.split("-")[0]), maxMonths: Number(range.split("-")[1]) } : undefined,
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
      <div role="radiogroup" aria-label="Tipo de público" className="flex flex-wrap gap-1.5">
        {([
          ["recentes", "Marcaram recentemente"],
          ["retorno", "Retorno: não vêm há um tempo"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => { setKind(value); invalidate(); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${kind === value ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "retorno" && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Pacientes cuja última consulta foi na faixa escolhida. Quem já tem consulta marcada fica de fora (pelo cadastro ou pelo telefone).
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Sexo
          <select value={sexo} onChange={(e) => { setSexo(e.target.value as "" | "F" | "M"); invalidate(); }} className={selectClass}>
            <option value="">Todos</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </label>
        {kind === "retorno" ? (
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Sem vir há
            <select value={range} onChange={(e) => { setRange(e.target.value); invalidate(); }} className={selectClass}>
              <option value="3-6">3 a 6 meses</option>
              <option value="6-12">6 a 12 meses</option>
              <option value="12-24">1 a 2 anos</option>
              <option value="24-36">2 a 3 anos</option>
            </select>
          </label>
        ) : (
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Última marcação
            <select value={months} onChange={(e) => { setMonths(Number(e.target.value)); invalidate(); }} className={selectClass}>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
              <option value={24}>Últimos 24 meses</option>
            </select>
          </label>
        )}
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Idade mínima
          <input type="number" min={0} max={120} value={minAge} onChange={(e) => { setMinAge(e.target.value); invalidate(); }} className={selectClass} />
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Idade máxima
          <input type="number" min={0} max={120} value={maxAge} placeholder="—" onChange={(e) => { setMaxAge(e.target.value); invalidate(); }} className={selectClass} />
        </label>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Pacientes que nunca recebem campanha: lista em <a href="/clinic/precos" className="font-medium underline underline-offset-2">Configurações › Parâmetros, Links e Campanhas</a>.
      </p>

      <button
        type="button"
        disabled={loading}
        onClick={handlePreview}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 rounded-lg disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Database className="w-3.5 h-3.5" aria-hidden />}
        {loading ? "Consultando o sistema da clínica…" : "Ver prévia do público"}
      </button>

      {s && preview && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {s.recipients} destinatário(s) — de {s.total} paciente(s) encontrados no sistema.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
            <li>Na lista de exclusão: <strong>{s.excludedManual}</strong></li>
            <li>Fora pela idade: <strong>{s.excludedAge}</strong></li>
            <li>Sem data de nascimento (fora): <strong>{s.excludedNoBirthDate}</strong></li>
            <li>Telefone inválido: <strong>{s.invalidPhone}</strong></li>
            <li>Pediram para não receber mais: <strong>{s.optedOut}</strong></li>
            <li>Número compartilhado (vai sem nome): <strong>{s.sharedPhones}</strong></li>
            {kind === "retorno" && (
              <>
                <li>Já têm consulta marcada: <strong>{s.excludedHasFuture}</strong></li>
                <li>Fora da faixa de tempo: <strong>{s.excludedRetornoRange}</strong></li>
              </>
            )}
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

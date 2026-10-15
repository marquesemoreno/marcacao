"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { clinicHasBridgeAudience, getCampaignExclusions, setCampaignExclusions } from "@/actions/clinic-broadcast";

/** Lista de exclusão de campanhas (vale pra todas): pacientes do sistema da clínica que
 * nunca recebem disparo. Saiu de dentro do público de cada campanha (crítica de Disparos,
 * 15/10/2026) — é configuração da clínica, não da campanha. Só aparece com ponte. */
export function CampaignExclusionsCard() {
  const [enabled, setEnabled] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    clinicHasBridgeAudience()
      .then((has) => {
        setEnabled(has);
        if (!has) return;
        return getCampaignExclusions().then((ids) => {
          const text = ids.join(", ");
          setValue(text);
          setSaved(text);
        });
      })
      .catch(() => {});
  }, []);

  if (!enabled) return null;

  async function save() {
    setSaving(true);
    try {
      const count = await setCampaignExclusions(value);
      setSaved(value);
      toast.success(`Lista de exclusão salva (${count} paciente${count === 1 ? "" : "s"}).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a lista.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pacientes que nunca recebem campanha</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Códigos de paciente do sistema da clínica (separados por vírgula). Vale para todas as campanhas com público do sistema da clínica.
      </p>
      <div className="flex gap-2">
        <label htmlFor="campaign-exclusions" className="sr-only">
          Códigos de paciente excluídos
        </label>
        <input
          id="campaign-exclusions"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex.: 9982, 11704"
          className="flex-1 h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
        <button
          type="button"
          disabled={saving || value === saved}
          onClick={save}
          className="h-9 px-4 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </section>
  );
}

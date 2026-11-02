"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listAutomationRules, saveAutomationRule, type AutomationRuleView } from "@/actions/automation-rules";
import type { ClinicCloudTemplate } from "@/actions/clinic-broadcast";
import { renderTemplatePreview } from "@/lib/broadcast-cloud-template";

const STEP_HELP: Record<AutomationRuleView["kind"], string> = {
  POS_CONSULTA: "Para quem consultou — pergunta como está e abre espaço para dúvidas.",
  RETORNO: "Para quem não voltou e não tem consulta marcada.",
  REATIVACAO: "Para quem sumiu há muito tempo e não tem consulta marcada.",
};

const field = "h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm";
const secondaryBtn = "h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium disabled:opacity-60";

function RuleCard({ rule, cloud, onSaved }: { rule: AutomationRuleView; cloud: { active: boolean; templates: ClinicCloudTemplate[] }; onSaved: () => void }) {
  const [daysAfter, setDaysAfter] = useState(rule.daysAfter);
  const [templateName, setTemplateName] = useState(rule.cloudTemplateName ?? "");
  const [params, setParams] = useState<string[]>(rule.cloudTemplateParams);
  const [saving, setSaving] = useState(false);
  const tpl = cloud.templates.find((t) => t.name === templateName);

  async function save(active: boolean) {
    setSaving(true);
    try {
      const r = await saveAutomationRule({ kind: rule.kind, daysAfter, active, cloudTemplateName: templateName || null, cloudTemplateParams: params });
      if (r.success) {
        toast.success(active ? `${rule.name} ligado — roda todo dia às 8h.` : `${rule.name} salvo.`);
        onSaved();
      } else toast.error(r.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3" aria-label={rule.name}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{rule.name}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{STEP_HELP[rule.kind]}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${rule.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}
        >
          {rule.active ? "Ligado" : "Desligado"}
        </span>
      </div>

      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        Enviar
        <input type="number" min={1} max={1095} value={daysAfter} onChange={(e) => setDaysAfter(Number(e.target.value))} className={`${field} w-20`} />
        dias depois da última consulta
      </label>

      <label className="block text-sm text-slate-700 dark:text-slate-300">
        Modelo aprovado pela Meta
        <select
          value={templateName}
          onChange={(e) => {
            setTemplateName(e.target.value);
            setParams([]);
          }}
          disabled={!cloud.active}
          className={`${field} mt-1 w-full`}
        >
          <option value="">{cloud.active ? "Escolha um modelo…" : "Disponível com a API oficial ativa"}</option>
          {cloud.templates.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {tpl &&
        Array.from({ length: tpl.variableCount }, (_, i) => (
          <label key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="w-12 shrink-0 font-mono">{`{{${i + 1}}}`}</span>
            <input
              value={params[i] ?? ""}
              placeholder="{{nome}} ou texto fixo"
              onChange={(e) => setParams((p) => Object.assign([...p], { [i]: e.target.value }))}
              className={`${field} flex-1`}
            />
          </label>
        ))}
      {tpl && (
        <p className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          {renderTemplatePreview(
            tpl.bodyText,
            params.map((p) => p.replace(/\{\{nome\}\}/gi, "Maria").replace(/\{\{saudacao\}\}/gi, "Oi, Maria")),
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {rule.sent30d} enviadas nos últimos 30 dias
          {rule.lastRunDate ? ` · última execução ${rule.lastRunDate.split("-").reverse().join("/")}` : ""}
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={() => save(false)} className={secondaryBtn}>
            {rule.active ? "Desligar" : "Salvar"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {rule.active ? "Salvar" : "Ligar"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function AutomationRulesSheet({
  open,
  onOpenChange,
  cloud,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cloud: { active: boolean; templates: ClinicCloudTemplate[] } | null;
}) {
  const [rules, setRules] = useState<AutomationRuleView[] | null>(null);
  const load = () =>
    listAutomationRules()
      .then(setRules)
      .catch(() => setRules([]));
  useEffect(() => {
    if (open) load();
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Régua automática</SheetTitle>
          <SheetDescription>
            Todo dia às 8h, quem teve a última consulta no dia certo entra numa campanha automática. O envio segue o ritmo dos Disparos e só vai
            para maiores de 18 anos com consentimento de marketing, sem repetir o mesmo passo em 30 dias.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-4">
          {cloud && !cloud.active && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              A régua só liga com a API oficial do WhatsApp ativa — mensagens automáticas diárias pelo número comum já causaram bloqueio.
            </p>
          )}
          {!rules ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" aria-label="Carregando" />
          ) : (
            rules.map((r) => (
              <RuleCard key={`${r.kind}-${r.active}-${r.lastRunDate}`} rule={r} cloud={cloud ?? { active: false, templates: [] }} onSaved={load} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

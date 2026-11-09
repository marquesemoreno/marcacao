"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getAutomationCloudSetup, listAutomationRules, previewAutomationRule, saveAutomationRule, type AutomationRuleView } from "@/actions/automation-rules";
import type { ClinicCloudTemplate } from "@/actions/clinic-broadcast";
import { renderTemplatePreview, templateLabel } from "@/lib/broadcast-cloud-template";

const STEP_HELP: Record<AutomationRuleView["kind"], string> = {
  POS_CONSULTA: "Para quem consultou — pergunta como está e abre espaço para dúvidas.",
  RETORNO: "Para quem não voltou e não tem consulta marcada.",
  REATIVACAO: "Para quem sumiu há muito tempo e não tem consulta marcada.",
  NPS: "Pede uma nota de 0 a 10 pelo link — use {{link}} num campo do modelo. Resultado em Relatório.",
  ANIVERSARIO: "No dia do aniversário, para quem passou na clínica nos últimos 2 anos.",
};

const field =
  "h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 aria-[invalid=true]:border-red-400";
const secondaryBtn =
  "h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60";

const validDays = (d: number) => Number.isInteger(d) && d >= 1 && d <= 1095;

function RuleCard({ rule, cloud, onSaved }: { rule: AutomationRuleView; cloud: { active: boolean; templates: ClinicCloudTemplate[] }; onSaved: () => void }) {
  const isBirthday = rule.kind === "ANIVERSARIO";
  const [daysAfter, setDaysAfter] = useState(rule.daysAfter);
  const [templateName, setTemplateName] = useState(rule.cloudTemplateName ?? "");
  const [params, setParams] = useState<string[]>(rule.cloudTemplateParams);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ loading: boolean; text: string | null }>({ loading: false, text: null });
  const tpl = cloud.templates.find((t) => t.name === templateName);

  const daysError = !isBirthday && !validDays(daysAfter) ? "Use um número inteiro de 1 a 1095 dias." : null;
  const emptyParams = tpl ? Array.from({ length: tpl.variableCount }, (_, i) => i).filter((i) => !(params[i] ?? "").trim()) : [];
  const paramsError = emptyParams.length ? `Preencha ${emptyParams.map((i) => `{{${i + 1}}}`).join(", ")}.` : null;
  const dirty =
    daysAfter !== rule.daysAfter ||
    templateName !== (rule.cloudTemplateName ?? "") ||
    JSON.stringify(params.slice(0, tpl?.variableCount ?? 0)) !== JSON.stringify(rule.cloudTemplateParams.slice(0, tpl?.variableCount ?? 0));
  const canTurnOn = cloud.active && !!tpl && !daysError && !paramsError;
  const blockedReason = rule.active || canTurnOn
    ? null
    : !cloud.active
      ? "Precisa da API oficial ativa."
      : !tpl
        ? "Escolha um modelo aprovado para ligar."
        : daysError
          ? "Corrija os dias para ligar."
          : "Preencha os campos do modelo para ligar.";

  // Prévia "Amanhã às 8h: ~N" — recalcula quando os dias mudam (o sistema da clínica responde em ~1s).
  useEffect(() => {
    if (daysError) {
      setPreview({ loading: false, text: null });
      return;
    }
    let alive = true;
    setPreview((p) => ({ ...p, loading: true }));
    const t = setTimeout(() => {
      previewAutomationRule({ kind: rule.kind, daysAfter })
        .then((r) => {
          if (!alive) return;
          setPreview({
            loading: false,
            text: r.ok ? `Amanhã às 8h: ~${r.count} ${r.count === 1 ? "paciente" : "pacientes"} (antes de pular quem não aceitou marketing)` : `Prévia indisponível: ${r.error}`,
          });
        })
        .catch(() => alive && setPreview({ loading: false, text: "Prévia indisponível agora." }));
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [rule.kind, daysAfter, daysError]);

  async function save(active: boolean) {
    setSaving(true);
    try {
      const r = await saveAutomationRule({ kind: rule.kind, daysAfter, active, cloudTemplateName: templateName || null, cloudTemplateParams: params });
      if (r.success) {
        toast.success(active !== rule.active ? (active ? `${rule.name} ligado — roda todo dia às 8h.` : `${rule.name} desligado.`) : "Alterações salvas.");
        onSaved();
      } else toast.error(r.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const switchId = `regua-${rule.kind}`;
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3" aria-labelledby={`${switchId}-title`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`${switchId}-title`} className="font-semibold text-slate-900 dark:text-slate-100">
            {rule.name}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{STEP_HELP[rule.kind]}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : rule.active ? "Ligado" : "Desligado"}
          <button
            type="button"
            role="switch"
            aria-checked={rule.active}
            aria-labelledby={`${switchId}-title`}
            disabled={saving || (!rule.active && !canTurnOn)}
            aria-describedby={blockedReason ? `${switchId}-why` : undefined}
            onClick={() => save(!rule.active)}
            className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50 ${rule.active ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600"}`}
          >
            <span aria-hidden className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${rule.active ? "translate-x-5" : ""}`} />
          </button>
        </label>
      </div>
      {blockedReason && (
        <p id={`${switchId}-why`} className="-mt-2 text-right text-xs text-slate-600 dark:text-slate-400">
          {blockedReason}
        </p>
      )}

      {!isBirthday && (
        <div>
          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            Enviar
            <input
              type="number"
              min={1}
              max={1095}
              value={Number.isNaN(daysAfter) ? "" : daysAfter}
              onChange={(e) => setDaysAfter(e.target.value === "" ? NaN : Number(e.target.value))}
              aria-invalid={!!daysError}
              aria-describedby={daysError ? `${switchId}-days-err` : undefined}
              className={`${field} w-20`}
            />
            dias depois da última consulta
          </label>
          {daysError && (
            <p id={`${switchId}-days-err`} role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">
              {daysError}
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-600 dark:text-slate-400" aria-live="polite">
        {preview.loading ? "Calculando quantos recebem amanhã…" : preview.text}
      </p>

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
              {templateLabel(t)}
            </option>
          ))}
        </select>
      </label>

      {tpl &&
        Array.from({ length: tpl.variableCount }, (_, i) => (
          <label key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="w-14 shrink-0 text-xs font-medium" aria-hidden>{`Campo ${i + 1}`}</span>
            <input
              value={params[i] ?? ""}
              placeholder="{{nome}} ou texto fixo"
              aria-label={`Campo ${i + 1} do modelo`}
              aria-invalid={emptyParams.includes(i)}
              onChange={(e) => setParams((p) => Object.assign([...p], { [i]: e.target.value }))}
              className={`${field} flex-1`}
            />
          </label>
        ))}
      {paramsError && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {paramsError}
        </p>
      )}
      {tpl && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-700 dark:text-slate-300">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Exemplo (paciente Maria):</p>
          <p className="whitespace-pre-wrap">
            {renderTemplatePreview(
              tpl.bodyText,
              params.map((p) => p.replace(/\{\{nome\}\}/gi, "Maria").replace(/\{\{saudacao\}\}/gi, "Oi, Maria").replace(/\{\{link\}\}/gi, "https://…/p/abc")),
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {rule.sent30d} enviadas nos últimos 30 dias
          {rule.lastRunDate ? ` · última execução ${rule.lastRunDate.split("-").reverse().join("/")}` : ""}
        </p>
        <button
          type="button"
          disabled={saving || !dirty || !!daysError || (rule.active && !!paramsError)}
          onClick={() => save(rule.active)}
          className={secondaryBtn}
        >
          Salvar alterações
        </button>
      </div>
    </section>
  );
}

export function AutomationRulesSheet({
  open,
  onOpenChange,
  cloud: cloudProp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cloud: { active: boolean; templates: ClinicCloudTemplate[] } | null;
}) {
  const [rules, setRules] = useState<AutomationRuleView[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // O Sheet busca a própria config (na clínica demo vêm modelos de exemplo); o prop é só o valor inicial.
  const [cloudSetup, setCloudSetup] = useState(cloudProp);
  const cloud = cloudSetup ?? cloudProp;
  const load = useCallback(() => {
    setLoadError(false);
    listAutomationRules()
      .then(setRules)
      .catch(() => setLoadError(true));
    getAutomationCloudSetup()
      .then(setCloudSetup)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Régua automática</SheetTitle>
          <SheetDescription>
            Todo dia às 8h, cada passo ligado vira uma campanha com o ritmo seguro dos Disparos. Só maiores de 18 anos com aceite de marketing, sem repetir o passo em 30
            dias.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-4">
          {cloud && !cloud.active && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              A régua só liga com a API oficial do WhatsApp ativa — mensagens automáticas diárias pelo número comum já causaram bloqueio.
            </p>
          )}
          {loadError ? (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              Não foi possível carregar a régua.{" "}
              <button type="button" onClick={load} className="font-semibold underline underline-offset-2">
                Tentar de novo
              </button>
            </div>
          ) : !rules ? (
            <p role="status" className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando a régua…
            </p>
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

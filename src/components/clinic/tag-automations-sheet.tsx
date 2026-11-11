"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getAutomationCloudSetup } from "@/actions/automation-rules";
import { deleteTagAutomation, listTagAutomations, saveTagAutomation, type TagAutomationView } from "@/actions/tag-automations";
import type { ClinicCloudTemplate } from "@/actions/clinic-broadcast";
import { renderTemplatePreview, templateLabel } from "@/lib/broadcast-cloud-template";
import { isServiceTemplate } from "@/lib/campaign-kind";
import { DELAY_OPTIONS, STAGE_OPTIONS, stageLabel, validateTagAutomation, type TagAutomationInput } from "@/lib/tag-automations";

type Cloud = { active: boolean; templates: ClinicCloudTemplate[] };

const field =
  "h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";
const secondaryBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60";
const primaryBtn = "inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60";

const EMPTY: TagAutomationInput = {
  name: "",
  triggerKind: "TAG",
  tag: "",
  stage: null,
  delayHours: 24,
  waitFrom: "ENTRY",
  stopOnReply: false,
  serviceNotice: false,
  action: "MESSAGE",
  mode: "REVIEW",
  reminderText: "",
  cloudTemplateName: null,
  cloudTemplateParams: [],
  active: false,
};

const delayLabel = (hours: number) => DELAY_OPTIONS.find((o) => o.hours === hours)?.label ?? `${hours} h depois`;

function toInput(a: TagAutomationView): TagAutomationInput {
  return {
    name: a.name,
    triggerKind: a.triggerKind,
    tag: a.tag,
    stage: a.stage,
    delayHours: a.delayHours,
    waitFrom: a.waitFrom,
    stopOnReply: a.stopOnReply,
    serviceNotice: a.serviceNotice,
    action: a.action,
    mode: a.mode,
    reminderText: a.reminderText,
    cloudTemplateName: a.cloudTemplateName,
    cloudTemplateParams: a.cloudTemplateParams,
    active: a.active,
  };
}

function savedMessage(active: boolean, wasActive: boolean, alreadyTagged: number | null): string {
  if (active && !wasActive) {
    return alreadyTagged
      ? `Ligada. ${alreadyTagged === 1 ? "1 conversa já estava" : `${alreadyTagged} conversas já estavam`} nessa situação e não recebe nada; vale para quem entrar a partir de agora.`
      : "Ligada. Vale para quem entrar a partir de agora.";
  }
  if (!active && wasActive) return "Automação desligada.";
  return "Automação salva.";
}

function Editor({
  initial,
  id,
  cloud,
  tags,
  onDone,
}: {
  initial: TagAutomationInput;
  id?: string;
  cloud: Cloud;
  tags: string[];
  onDone: (saved: boolean) => void;
}) {
  const uid = useId();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof TagAutomationInput>(key: K, value: TagAutomationInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const tpl = cloud.templates.find((t) => t.name === form.cloudTemplateName);
  const emptyParams = tpl ? Array.from({ length: tpl.variableCount }, (_, i) => i).filter((i) => !(form.cloudTemplateParams[i] ?? "").trim()) : [];
  const wrongCategory = form.action === "MESSAGE" && form.serviceNotice && !!tpl && !isServiceTemplate(tpl);
  const error =
    validateTagAutomation(form) ??
    (form.action === "MESSAGE" && emptyParams.length ? `Preencha ${emptyParams.map((i) => `o campo ${i + 1}`).join(", ")} do modelo.` : null) ??
    (wrongCategory ? "Aviso de serviço só com modelo da categoria Utilidade. Escolha outro modelo ou desmarque o aviso de serviço." : null);

  async function save() {
    setTried(true);
    if (error) return;
    setSaving(true);
    try {
      const r = await saveTagAutomation({ ...form, id });
      if (r.success) {
        toast.success(savedMessage(form.active, initial.active, r.alreadyTagged));
        onDone(true);
      } else toast.error(r.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-emerald-300 dark:border-emerald-800 p-4" aria-label={id ? "Editar automação" : "Nova automação"}>
      <div>
        <label htmlFor={`${uid}-name`} className={labelClass}>
          Nome
        </label>
        <input id={`${uid}-name`} value={form.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Depois da aula experimental" className={`${field} mt-1`} />
      </div>

      <fieldset>
        <legend className={labelClass}>Quando a conversa</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["TAG", "Receber uma tag", "Ex.: Aula experimental, Aguardando convênio."],
              ["STAGE", "Entrar numa etapa do CRM", "Ex.: Orçamento, Em atendimento."],
            ] as const
          ).map(([value, title, help]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border p-3 text-sm ${form.triggerKind === value ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-700"}`}
            >
              <input type="radio" name={`${uid}-trigger`} value={value} checked={form.triggerKind === value} onChange={() => set("triggerKind", value)} className="sr-only" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">{help}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {form.triggerKind === "STAGE" ? (
        <div>
          <label htmlFor={`${uid}-stage`} className={labelClass}>
            Etapa
          </label>
          <select id={`${uid}-stage`} value={form.stage ?? ""} onChange={(e) => set("stage", e.target.value || null)} className={`${field} mt-1`}>
            <option value="">Escolha a etapa…</option>
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Vale para conversas em aberto. Se a conversa sair da etapa ou for finalizada antes da hora, nada acontece.</p>
        </div>
      ) : (
        <div>
          <label htmlFor={`${uid}-tag`} className={labelClass}>
            Tag
          </label>
          <input id={`${uid}-tag`} list={`${uid}-tags`} value={form.tag} maxLength={100} onChange={(e) => set("tag", e.target.value)} placeholder="Escolha ou digite a tag" className={`${field} mt-1`} />
          <datalist id={`${uid}-tags`}>
            {tags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Escreva igual à tag usada no Chat e no CRM. Se a tag sair antes da hora, nada acontece.</p>
        </div>
      )}

      <div>
        <label htmlFor={`${uid}-delay`} className={labelClass}>
          Esperar
        </label>
        <select id={`${uid}-delay`} value={form.delayHours} onChange={(e) => set("delayHours", Number(e.target.value))} className={`${field} mt-1`}>
          {(DELAY_OPTIONS.some((o) => o.hours === form.delayHours) ? DELAY_OPTIONS : [...DELAY_OPTIONS, { hours: form.delayHours, label: delayLabel(form.delayHours) }]).map((o) => (
            <option key={o.hours} value={o.hours}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={labelClass}>Contar a espera</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["ENTRY", "Desde que entrou", "Passou o tempo, executa — mesmo que tenham conversado."],
              ["LAST_MESSAGE", "Desde a última mensagem", "Só executa se a conversa ficar parada esse tempo todo."],
            ] as const
          ).map(([value, title, help]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border p-3 text-sm ${form.waitFrom === value ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-700"}`}
            >
              <input type="radio" name={`${uid}-wait`} value={value} checked={form.waitFrom === value} onChange={() => set("waitFrom", value)} className="sr-only" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">{help}</span>
            </label>
          ))}
        </div>
        <label className="mt-2 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={form.stopOnReply} onChange={(e) => set("stopOnReply", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600" />
          <span>
            Cancelar se o paciente responder antes
            <span className="block text-xs text-slate-600 dark:text-slate-400">Se ele escrever depois de entrar na automação, nada é enviado nem lembrado.</span>
          </span>
        </label>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>E então</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["MESSAGE", "Enviar mensagem", "Um modelo aprovado pela Meta, pelo WhatsApp."],
              ["REMINDER", "Lembrar a recepção", "Nota na conversa e a tag 🔔 Lembrete. Nada vai para o paciente."],
            ] as const
          ).map(([value, title, help]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border p-3 text-sm ${form.action === value ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-700"}`}
            >
              <input type="radio" name={`${uid}-action`} value={value} checked={form.action === value} onChange={() => set("action", value)} className="sr-only" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">{help}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {form.action === "REMINDER" ? (
        <div>
          <label htmlFor={`${uid}-reminder`} className={labelClass}>
            Lembrete para a recepção
          </label>
          <textarea
            id={`${uid}-reminder`}
            rows={2}
            maxLength={300}
            value={form.reminderText}
            onChange={(e) => set("reminderText", e.target.value)}
            placeholder="Ex.: Cobrar a autorização do convênio e avisar o paciente."
            className={`${field} mt-1 h-auto py-2`}
          />
        </div>
      ) : (
        <>
          {!cloud.active && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Mensagem automática só liga com a API oficial do WhatsApp ativa. Dá para salvar desligada, ou usar o lembrete para a recepção.
            </p>
          )}
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={form.serviceNotice} onChange={(e) => set("serviceNotice", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600" />
            <span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">É aviso de serviço, não propaganda</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                Ex.: laudo pronto, convênio autorizou, documento pendente. Vai também para quem não aceitou marketing. Só funciona com modelo da categoria Utilidade.
              </span>
            </span>
          </label>
          <div>
            <label htmlFor={`${uid}-tpl`} className={labelClass}>
              Modelo aprovado pela Meta
            </label>
            <select
              id={`${uid}-tpl`}
              value={form.cloudTemplateName ?? ""}
              disabled={!cloud.active}
              onChange={(e) => setForm((f) => ({ ...f, cloudTemplateName: e.target.value || null, cloudTemplateParams: [] }))}
              className={`${field} mt-1`}
            >
              <option value="">{cloud.active ? "Escolha um modelo…" : "Disponível com a API oficial ativa"}</option>
              {cloud.templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {templateLabel(t)}
                </option>
              ))}
            </select>
          </div>
          {tpl &&
            Array.from({ length: tpl.variableCount }, (_, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="w-16 shrink-0 text-xs font-medium" aria-hidden>{`Campo ${i + 1}`}</span>
                <input
                  value={form.cloudTemplateParams[i] ?? ""}
                  placeholder="{{nome}} ou texto fixo"
                  aria-label={`Campo ${i + 1} do modelo`}
                  onChange={(e) => set("cloudTemplateParams", Object.assign([...form.cloudTemplateParams], { [i]: e.target.value }))}
                  className={field}
                />
              </label>
            ))}
          {tpl && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-700 dark:text-slate-300">
              <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Exemplo (paciente Maria):</p>
              <p className="whitespace-pre-wrap">
                {renderTemplatePreview(
                  tpl.bodyText,
                  form.cloudTemplateParams.map((p) => p.replace(/\{\{nome\}\}/gi, "Maria").replace(/\{\{saudacao\}\}/gi, "Oi, Maria")),
                )}
              </p>
            </div>
          )}
          <fieldset>
            <legend className={labelClass}>Como enviar</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["REVIEW", "Revisar antes", "Vira um rascunho em Disparos. Alguém confere e clica em Iniciar."],
                  ["AUTO", "Enviar sozinho", "Sai no ritmo seguro dos Disparos, sem ninguém conferir."],
                ] as const
              ).map(([value, title, help]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg border p-3 text-sm ${form.mode === value ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-700"}`}
                >
                  <input type="radio" name={`${uid}-mode`} value={value} checked={form.mode === value} onChange={() => set("mode", value)} className="sr-only" />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-400">{help}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              {form.serviceNotice
                ? "Aviso de serviço: recebe todo paciente que entrar na automação, menos quem pediu para sair."
                : "Só recebe quem aceitou mensagens de marketing da clínica e não pediu para sair."}
            </p>
          </fieldset>
        </>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />
        Ligada
      </label>

      {tried && error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onDone(false)} disabled={saving} className={secondaryBtn}>
          Cancelar
        </button>
        <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Salvar
        </button>
      </div>
    </section>
  );
}

function Card({ automation, onEdit, onChanged }: { automation: TagAutomationView; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleId = useId();

  async function toggle() {
    setBusy(true);
    try {
      const r = await saveTagAutomation({ ...toInput(automation), active: !automation.active, id: automation.id });
      if (r.success) {
        toast.success(savedMessage(!automation.active, automation.active, r.alreadyTagged));
        onChanged();
      } else toast.error(r.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const r = await deleteTagAutomation(automation.id);
      if (r.success) {
        toast.success("Automação excluída.");
        onChanged();
      } else toast.error(r.error);
    } catch {
      toast.error("Não foi possível excluir.");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const what =
    automation.action === "REMINDER"
      ? "lembra a recepção"
      : `envia o modelo ${automation.cloudTemplateName ?? "(sem modelo)"} · ${automation.mode === "AUTO" ? "sozinho" : "com revisão"}${automation.serviceNotice ? " · aviso de serviço" : ""}`;

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4" aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="font-semibold text-slate-900 dark:text-slate-100">
            {automation.name}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {automation.triggerKind === "STAGE" ? "Etapa" : "Tag"}{" "}
            <strong className="font-semibold text-slate-800 dark:text-slate-200">{automation.triggerKind === "STAGE" ? stageLabel(automation.stage) : automation.tag}</strong> ·{" "}
            {delayLabel(automation.delayHours)}
            {automation.waitFrom === "LAST_MESSAGE" ? " sem mensagem" : ""} · {what}
            {automation.stopOnReply ? " · cancela se o paciente responder" : ""}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : automation.active ? "Ligada" : "Desligada"}
          <button
            type="button"
            role="switch"
            aria-checked={automation.active}
            aria-labelledby={titleId}
            disabled={busy}
            onClick={toggle}
            className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50 ${automation.active ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600"}`}
          >
            <span aria-hidden className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${automation.active ? "translate-x-5" : ""}`} />
          </button>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {automation.pending} esperando a hora · {automation.done30d} nos últimos 30 dias
        </p>
        <div className="flex gap-2">
          {confirmDelete ? (
            <>
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className={secondaryBtn}>
                Manter
              </button>
              <button type="button" onClick={remove} disabled={busy} className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                Excluir de vez
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className={secondaryBtn} aria-label={`Excluir ${automation.name}`}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={onEdit} disabled={busy} className={secondaryBtn}>
                <Pencil className="h-4 w-4" aria-hidden /> Editar
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function TagAutomationsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = useState<{ automations: TagAutomationView[]; tags: string[] } | null>(null);
  const [cloud, setCloud] = useState<Cloud>({ active: false, templates: [] });
  const [loadError, setLoadError] = useState(false);
  /** "new" = formulário de nova automação; id = editando aquela. */
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    listTagAutomations()
      .then(setData)
      .catch(() => setLoadError(true));
    getAutomationCloudSetup()
      .then(setCloud)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (open) {
      setEditing(null);
      load();
    }
  }, [open, load]);

  const done = (saved: boolean) => {
    setEditing(null);
    if (saved) load();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Automações</SheetTitle>
          <SheetDescription>
            Quando uma conversa recebe uma tag ou entra numa etapa do CRM, o sistema espera o tempo escolhido e envia um modelo aprovado ou lembra a recepção. Quem já
            está nessa situação na hora de ligar não recebe nada.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-4">
          {loadError ? (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              Não foi possível carregar as automações.{" "}
              <button type="button" onClick={load} className="font-semibold underline underline-offset-2">
                Tentar de novo
              </button>
            </div>
          ) : !data ? (
            <p role="status" className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando as automações…
            </p>
          ) : (
            <>
              {data.automations.length === 0 && editing !== "new" && (
                <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-400">
                  Nenhuma automação ainda. Exemplos: tag “Aula experimental”, 1 dia depois, enviar o modelo perguntando como foi. Etapa “Orçamento”, 3 dias sem mensagem,
                  lembrar a recepção.
                </p>
              )}
              {data.automations.map((a) =>
                editing === a.id ? (
                  <Editor key={a.id} id={a.id} initial={toInput(a)} cloud={cloud} tags={data.tags} onDone={done} />
                ) : (
                  <Card key={a.id} automation={a} onEdit={() => setEditing(a.id)} onChanged={load} />
                ),
              )}
              {editing === "new" ? (
                <Editor initial={EMPTY} cloud={cloud} tags={data.tags} onDone={done} />
              ) : (
                <button type="button" onClick={() => setEditing("new")} className={primaryBtn}>
                  <Plus className="h-4 w-4" aria-hidden /> Nova automação
                </button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { PageHeader } from "@/components/clinic/page-header";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Copy, Image as ImageIcon, Loader2, Pause, Play, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listClinicBroadcastCampaigns,
  createClinicBroadcastCampaign,
  startClinicBroadcastCampaign,
  setClinicCampaignLowPriority,
  pauseClinicBroadcastCampaign,
  clinicHasBridgeAudience,
  getClinicCampaignStartPreview,
  deleteClinicDraftCampaign,
  getClinicCampaignForDuplicate,
} from "@/actions/clinic-broadcast";
import { BridgeAudiencePicker } from "@/components/clinic/bridge-audience-picker";
import { listMarcadoresAudience } from "@/actions/marcadores";
import { SELECTION_BROADCAST_KEY } from "@/components/clinic/patient-list-table";
import { parseBroadcastCsv, BROADCAST_OPT_OUT_FOOTER, type ParsedBroadcastRecipient } from "@/lib/broadcast-csv";
import { estimateCampaignFinish, unknownTemplateVariables } from "@/lib/broadcast-schedule";
import { RescheduleBroadcastModal } from "@/components/clinic/reschedule-broadcast-modal";

type Campaign = Awaited<ReturnType<typeof listClinicBroadcastCampaigns>>[number];
type StartPreview = Awaited<ReturnType<typeof getClinicCampaignStartPreview>>;
type Source = "csv" | "bridge" | "selecao" | "marcadores";

const STATUS_LABEL: Record<Campaign["status"], string> = {
  DRAFT: "Rascunho",
  RUNNING: "Em andamento",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
};

const STATUS_CLASS: Record<Campaign["status"], string> = {
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  RUNNING: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  PAUSED: "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  COMPLETED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

const SITUATION_CLASS = {
  ok: "text-emerald-700 dark:text-emerald-400",
  wait: "text-amber-700 dark:text-amber-400",
  idle: "text-slate-500 dark:text-slate-400",
  done: "text-slate-500 dark:text-slate-400",
} as const;

const MARCADORES_TEMPLATE = `Olá, {{nome}}! Tudo bem? 😊

Passando para avisar que temos novos médicos na nossa equipe!

👨‍⚕️ [NOME DO MÉDICO] — [ESPECIALIDADE]
📅 Atendimento: [DIAS E HORÁRIOS]

Para agendar seus pacientes, é só encaminhar este link — assim já sabemos que a indicação é sua:
{{link}}

Qualquer dúvida, estamos à disposição!`;

const inputClass =
  "w-full mt-1 h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-400";
const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";

function brDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function estimateText(businessDays: number, finishIso: string | null): string {
  if (!finishIso) return "";
  return businessDays <= 1 ? `termina ${brDate(finishIso)}` : `cerca de ${businessDays} dias úteis — termina ${brDate(finishIso)}`;
}

/** Tela de Disparos (crítica 15/10/2026): campanhas no topo com a situação de cada uma
 * (enviando / fora do horário / cedendo a vez / limite do dia) e previsão de término;
 * "Nova campanha" atrás de um botão, na ordem Público → Mensagem → Imagem; Iniciar
 * sempre passa por uma confirmação com a mensagem como o 1º destinatário vai receber. */
export function BroadcastManagement() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");
  const [csvText, setCsvText] = useState("");
  const [recipients, setRecipients] = useState<ParsedBroadcastRecipient[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [hasBridge, setHasBridge] = useState(false);
  const [marcadoresAudience, setMarcadoresAudience] = useState<ParsedBroadcastRecipient[]>([]);
  const [audienceSource, setAudienceSource] = useState<Source>("csv");
  const [pickerKey, setPickerKey] = useState(0);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const [confirming, setConfirming] = useState<{ campaign: Campaign; preview: StartPreview | null } | null>(null);

  const loadCampaigns = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setCampaigns(await listClinicBroadcastCampaigns());
    } catch {
      if (!silent) toast.error("Não foi possível carregar as campanhas. Recarregue a página.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    clinicHasBridgeAudience().then(setHasBridge).catch(() => {});
    listMarcadoresAudience().then(setMarcadoresAudience).catch(() => {});
    // "Enviar disparo" da lista de pacientes chega com ?selecao=1 e a seleção no
    // sessionStorage — vira o público desta campanha (lido uma vez e apagado).
    if (new URLSearchParams(window.location.search).get("selecao") === "1") {
      const raw = sessionStorage.getItem(SELECTION_BROADCAST_KEY);
      sessionStorage.removeItem(SELECTION_BROADCAST_KEY);
      try {
        const parsed = raw ? (JSON.parse(raw) as ParsedBroadcastRecipient[]) : [];
        if (parsed.length > 0) {
          setAudienceSource("selecao");
          setRecipients(parsed);
          setFormOpen(true);
        }
      } catch {
        // seleção inválida: segue com o formulário normal
      }
    }
  }, [loadCampaigns]);

  // Enquanto houver campanha enviando, atualiza a lista sozinha (progresso e situação).
  const anyRunning = campaigns.some((c) => c.status === "RUNNING");
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => loadCampaigns(true), 60_000);
    return () => clearInterval(t);
  }, [anyRunning, loadCampaigns]);

  function switchSource(next: Source) {
    setAudienceSource(next);
    setRecipients(next === "marcadores" ? marcadoresAudience : []);
    setCsvText("");
    setCsvError(null);
  }

  function handleCsvChange(value: string) {
    setCsvText(value);
    setCsvError(null);
    if (!value.trim()) {
      setRecipients([]);
      return;
    }
    try {
      setRecipients(parseBroadcastCsv(value));
    } catch (error) {
      setRecipients([]);
      setCsvError(error instanceof Error ? error.message : "Lista inválida.");
    }
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => handleCsvChange(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  }

  function handleImageSelect(file: File) {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImage(null);
    setImagePreviewUrl(null);
  }

  function resetForm() {
    setName("");
    setTemplate("");
    setCsvText("");
    setCsvError(null);
    setRecipients([]);
    setAudienceSource("csv");
    setPickerKey((k) => k + 1);
    handleRemoveImage();
  }

  function insertVariable(key: string) {
    const el = templateRef.current;
    const token = `{{${key}}}`;
    if (!el) return setTemplate((t) => t + token);
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    const next = template.slice(0, start) + token + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleCreate() {
    if (recipients.length === 0) {
      toast.error(
        audienceSource === "bridge"
          ? "Clique em “Ver prévia do público” e confira antes de criar a campanha."
          : audienceSource === "csv"
            ? "Cole ou envie a lista de contatos antes de criar a campanha."
            : "O público está vazio."
      );
      return;
    }
    setCreating(true);
    try {
      let imageFormData: FormData | undefined;
      if (image) {
        imageFormData = new FormData();
        imageFormData.set("image", image);
      }
      await createClinicBroadcastCampaign(name, template, recipients, imageFormData);
      toast.success("Campanha criada como rascunho. Confira e clique em Iniciar quando estiver pronto.");
      resetForm();
      setFormOpen(false);
      await loadCampaigns(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a campanha.");
    } finally {
      setCreating(false);
    }
  }

  async function askStart(campaign: Campaign) {
    setConfirming({ campaign, preview: null });
    try {
      const preview = await getClinicCampaignStartPreview(campaign.id);
      setConfirming({ campaign, preview });
    } catch {
      setConfirming(null);
      toast.error("Não foi possível montar a prévia. Tente de novo.");
    }
  }

  async function confirmStart() {
    if (!confirming) return;
    const { campaign } = confirming;
    setBusyId(campaign.id);
    try {
      await startClinicBroadcastCampaign(campaign.id);
      toast.success(`“${campaign.name}” iniciada. O envio segue o ritmo seguro, sem precisar ficar na tela.`);
      setConfirming(null);
      await loadCampaigns(true);
    } catch {
      toast.error("Não foi possível iniciar a campanha. Tente de novo.");
    } finally {
      setBusyId(null);
    }
  }

  async function pause(campaign: Campaign) {
    setBusyId(campaign.id);
    try {
      await pauseClinicBroadcastCampaign(campaign.id);
      toast.success(`“${campaign.name}” pausada.`);
      await loadCampaigns(true);
    } catch {
      toast.error("Não foi possível pausar a campanha. Tente de novo.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeDraft(campaign: Campaign) {
    if (!window.confirm(`Excluir o rascunho “${campaign.name}”?`)) return;
    setBusyId(campaign.id);
    try {
      await deleteClinicDraftCampaign(campaign.id);
      toast.success("Rascunho excluído.");
      await loadCampaigns(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(campaign: Campaign) {
    setBusyId(campaign.id);
    try {
      const copy = await getClinicCampaignForDuplicate(campaign.id);
      resetForm();
      setName(copy.name);
      setTemplate(copy.template);
      setAudienceSource("csv");
      setRecipients(copy.recipients);
      setCsvText("");
      setFormOpen(true);
      toast.success(
        `Cópia aberta em “Nova campanha” com ${copy.recipients.length} destinatário(s).${campaign.hasImage ? " Anexe a imagem de novo." : ""}`
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast.error("Não foi possível duplicar.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleLowPriority(c: Campaign) {
    try {
      await setClinicCampaignLowPriority(c.id, !c.lowPriority);
      toast.success(!c.lowPriority ? `“${c.name}” agora cede a vez a lembretes e outras campanhas.` : `“${c.name}” volta à prioridade normal.`);
      await loadCampaigns(true);
    } catch {
      toast.error("Não foi possível salvar.");
    }
  }

  const sampleVars = recipients[0]?.variables ?? {};
  const columns = Object.keys(sampleVars);
  const unknownVars = template.trim() && recipients.length ? unknownTemplateVariables(template, sampleVars) : [];
  const formEstimate = recipients.length ? estimateCampaignFinish({ pending: recipients.length, sentToday: 0, now: new Date() }) : null;
  const sourceOptions: [Source, string][] = [
    ...(audienceSource === "selecao" ? ([["selecao", `Seleção da lista de pacientes`]] as [Source, string][]) : []),
    ...(hasBridge ? ([["bridge", "Pacientes do sistema da clínica"]] as [Source, string][]) : []),
    ...(marcadoresAudience.length > 0 ? ([["marcadores", `Marcadores (${marcadoresAudience.length})`]] as [Source, string][]) : []),
    ["csv", "Colar lista / arquivo"],
  ];

  const active = campaigns.filter((c) => c.status !== "COMPLETED");
  const done = campaigns.filter((c) => c.status === "COMPLETED");

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Disparos"
        subtitle={loading ? "Carregando…" : `${campaigns.filter((c) => c.status === "RUNNING").length} em andamento · ${campaigns.length} campanha(s)`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRescheduleModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
            >
              <CalendarClock className="w-4 h-4" aria-hidden />
              Aviso de remarcação
            </button>
            <button
              type="button"
              onClick={() => setFormOpen((o) => !o)}
              aria-expanded={formOpen}
              className="inline-flex h-9 items-center gap-1.5 px-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
            >
              {formOpen ? <X className="w-4 h-4" aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />}
              {formOpen ? "Fechar" : "Nova campanha"}
            </button>
          </div>
        }
      />

      <RescheduleBroadcastModal
        open={rescheduleModalOpen}
        onOpenChange={(next) => {
          setRescheduleModalOpen(next);
          if (!next) loadCampaigns(true);
        }}
      />

      {formOpen && (
        <section className={`${panel} p-5 space-y-5`} aria-labelledby="new-campaign-title">
          <h2 id="new-campaign-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Nova campanha
          </h2>

          <div>
            <label htmlFor="broadcast-name" className={labelClass}>
              Nome da campanha (só a equipe vê)
            </label>
            <input
              id="broadcast-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Novos médicos — marcadores"
              className={inputClass}
            />
          </div>

          {/* 1. Público */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">1. Para quem</legend>
            <div role="radiogroup" aria-label="Público" className="inline-flex flex-wrap rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-sm">
              {sourceOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={audienceSource === value}
                  onClick={() => switchSource(value)}
                  className={`px-3 h-8 rounded-md font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                    audienceSource === value ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {audienceSource === "selecao" ? (
              <p className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-900 dark:text-emerald-200">
                <strong>{recipients.length} paciente(s)</strong> selecionado(s) na lista de pacientes.
              </p>
            ) : audienceSource === "marcadores" ? (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm space-y-1 text-emerald-900 dark:text-emerald-200">
                <p>
                  <strong>{recipients.length} marcador(es) ativo(s)</strong> — cadastro em Marcadores. Use {"{{link}}"} para o link pessoal de cada um: quem
                  chegar por ele conta no relatório do marcador.
                </p>
                {!template.trim() && (
                  <button type="button" onClick={() => setTemplate(MARCADORES_TEMPLATE)} className="font-semibold underline underline-offset-2">
                    Usar modelo de aviso de novos médicos
                  </button>
                )}
              </div>
            ) : audienceSource === "bridge" ? (
              <BridgeAudiencePicker key={pickerKey} onRecipients={setRecipients} />
            ) : (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="broadcast-csv" className={labelClass}>
                    Lista de contatos — um por linha: telefone, nome (pode colar de uma planilha)
                  </label>
                  <label className="relative inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500/50 rounded-md px-1">
                    <Upload className="w-3.5 h-3.5" aria-hidden /> Enviar arquivo
                    <input
                      type="file"
                      accept=".csv,text/csv,text/plain"
                      className="sr-only"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                  </label>
                </div>
                <textarea
                  id="broadcast-csv"
                  rows={5}
                  value={csvText}
                  onChange={(e) => handleCsvChange(e.target.value)}
                  placeholder={"telefone,nome,procedimento\n77999998888,Maria Silva,Consulta Urológica"}
                  className="w-full mt-1 px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-y"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Sem cabeçalho, a ordem é telefone, nome, procedimento, data. Com cabeçalho, cada coluna vira uma variável da mensagem.
                </p>
                {csvError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{csvError}</p>}
                {recipients.length > 0 && (
                  <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">{recipients.length} contato(s) na lista.</p>
                )}
              </div>
            )}
          </fieldset>

          {/* 2. Mensagem */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">2. Mensagem</legend>
            <label htmlFor="broadcast-template" className="sr-only">
              Texto da mensagem
            </label>
            <textarea
              id="broadcast-template"
              ref={templateRef}
              rows={7}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder={"Ex.: Olá {{nome}}, temos novidades para você…"}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-y"
            />
            {columns.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Inserir:</span>
                {columns.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => insertVariable(c)}
                    className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {`{{${c}}}`}
                  </button>
                ))}
              </div>
            )}
            {unknownVars.length > 0 && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {unknownVars.map((v) => `{{${v}}}`).join(", ")} não existe neste público — o paciente receberia o texto entre chaves. Corrija antes de
                criar.
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toda mensagem termina com “{BROADCAST_OPT_OUT_FOOTER}” — quem responder 9 não recebe mais campanhas.
            </p>
          </fieldset>

          {/* 3. Imagem */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">3. Imagem (opcional)</legend>
            {imagePreviewUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreviewUrl} alt="Prévia da imagem da campanha" className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-800" />
                <button type="button" onClick={handleRemoveImage} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                  <X className="w-4 h-4" aria-hidden /> Remover
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500/50 rounded-md px-1">
                <ImageIcon className="w-4 h-4" aria-hidden /> Anexar imagem
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                />
              </label>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {formEstimate
                ? `${recipients.length} destinatário(s) · envio seguro: 1 a cada 4–6 min, seg–sex 9h–17h, até 100/dia — ${estimateText(formEstimate.businessDays, formEstimate.finishIso)} se começar agora.`
                : "Escolha o público para ver a previsão de envio."}
            </p>
            <button
              type="button"
              disabled={creating || unknownVars.length > 0}
              onClick={handleCreate}
              className="inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              Criar rascunho
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="campaigns-title">
        <h2 id="campaigns-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Campanhas
        </h2>
        {loading ? (
          <div className={`${panel} p-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2`}>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…
          </div>
        ) : campaigns.length === 0 ? (
          <div className={`${panel} p-6 text-center text-sm text-slate-500 dark:text-slate-400`}>
            Nenhuma campanha ainda. Clique em “Nova campanha” para começar.
          </div>
        ) : (
          <>
            {active.map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                busy={busyId === c.id}
                onStart={() => askStart(c)}
                onPause={() => pause(c)}
                onDelete={() => removeDraft(c)}
                onDuplicate={() => duplicate(c)}
                onToggleLowPriority={() => toggleLowPriority(c)}
              />
            ))}
            {done.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300 py-1">
                  Concluídas ({done.length})
                </summary>
                <div className="mt-2 space-y-3">
                  {done.map((c) => (
                    <CampaignCard
                      key={c.id}
                      c={c}
                      busy={busyId === c.id}
                      onStart={() => {}}
                      onPause={() => {}}
                      onDelete={() => {}}
                      onDuplicate={() => duplicate(c)}
                      onToggleLowPriority={() => {}}
                    />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Iniciar “{confirming?.campaign.name}”?</DialogTitle>
          </DialogHeader>
          {!confirming?.preview ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Montando a prévia…
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Vai para <strong>{confirming.preview.pending} pessoa(s)</strong>, uma a cada 4–6 min, de segunda a sexta das 9h às 17h, até 100 por dia —{" "}
                {estimateText(confirming.preview.businessDays, confirming.preview.finishIso)}.
                {confirming.preview.lowPriority && " Como é de baixa prioridade, espera os lembretes e outras campanhas e pode demorar mais."}
              </p>
              <div>
                <p className={labelClass}>
                  Como chega para o 1º destinatário{confirming.preview.samplePhone ? ` (${confirming.preview.samplePhone})` : ""}:
                </p>
                <div className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 text-sm text-slate-900 dark:text-slate-100">
                  {confirming.preview.hasImage && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">[imagem anexada]</p>}
                  {confirming.preview.sampleMessage}
                </div>
              </div>
              {confirming.preview.unknownVariables.length > 0 && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  Atenção: {confirming.preview.unknownVariables.map((v) => `{{${v}}}`).join(", ")} vai sair escrito assim, entre chaves. Duplique a
                  campanha e corrija o texto antes de iniciar.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="h-9 px-4 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={busyId === confirming.campaign.id || confirming.preview.pending === 0}
                  onClick={confirmStart}
                  className="inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg"
                >
                  {busyId === confirming.campaign.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Play className="w-4 h-4" aria-hidden />}
                  Iniciar envio para {confirming.preview.pending}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CampaignCard({
  c,
  busy,
  onStart,
  onPause,
  onDelete,
  onDuplicate,
  onToggleLowPriority,
}: {
  c: Campaign;
  busy: boolean;
  onStart: () => void;
  onPause: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleLowPriority: () => void;
}) {
  const progress = c.total ? Math.round(((c.sent + c.failed + c.skipped) / c.total) * 100) : 0;
  const actionBtn =
    "inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";
  return (
    <article className={`${panel} p-4 space-y-3`} aria-label={c.name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{c.name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            {c.hasImage && <ImageIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" aria-label="Com imagem" />}
          </div>
          <p className={`mt-1 text-sm font-medium ${SITUATION_CLASS[c.situation.tone]}`} aria-live="polite">
            {c.situation.text}
            {c.finishIso && c.status === "RUNNING" && <span className="font-normal text-slate-500 dark:text-slate-400"> · {estimateText(c.businessDays, c.finishIso)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.status === "RUNNING" ? (
            <button type="button" disabled={busy} onClick={onPause} className={actionBtn} aria-label={`Pausar ${c.name}`}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Pause className="w-3.5 h-3.5" aria-hidden />} Pausar
            </button>
          ) : c.status !== "COMPLETED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={onStart}
              className="inline-flex h-8 items-center gap-1.5 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              aria-label={`${c.status === "PAUSED" ? "Retomar" : "Iniciar"} ${c.name}`}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Play className="w-3.5 h-3.5" aria-hidden />}
              {c.status === "PAUSED" ? "Retomar" : "Iniciar"}
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={onDuplicate} className={actionBtn} aria-label={`Duplicar ${c.name}`}>
            <Copy className="w-3.5 h-3.5" aria-hidden /> Duplicar
          </button>
          {c.status === "DRAFT" && (
            <button type="button" disabled={busy} onClick={onDelete} className={`${actionBtn} text-red-700 dark:text-red-400`} aria-label={`Excluir ${c.name}`}>
              <Trash2 className="w-3.5 h-3.5" aria-hidden /> Excluir
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do envio">
          <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
          {c.sent} de {c.total} enviadas
          {c.pending > 0 && c.status !== "DRAFT" && ` · ${c.pending} na fila`}
          {c.skipped > 0 && ` · ${c.skipped} pediram para não receber`}
          {c.failed > 0 && (
            <span className="text-red-700 dark:text-red-400" title={c.failureReasons.join("\n") || undefined}>
              {" "}
              · {c.failed} falha(s){c.failureReasons[0] ? ` (${c.failureReasons[0]})` : ""}
            </span>
          )}
        </p>
      </div>

      {c.status !== "COMPLETED" && (
        <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={c.lowPriority} onChange={onToggleLowPriority} className="mt-0.5 size-3.5 accent-emerald-600" />
          <span>
            <span className="font-medium">Baixa prioridade</span> — espera os lembretes de confirmação e outras campanhas terminarem.
          </span>
        </label>
      )}
    </article>
  );
}

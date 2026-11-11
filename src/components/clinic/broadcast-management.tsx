"use client";

import { normalizeBroadcastVariants, previewBroadcastVariants } from "@/lib/broadcast-variants";
import { buildTemplateParams, checkTemplateParamSources, renderTemplatePreview, templateLabel } from "@/lib/broadcast-cloud-template";
import { PageHeader } from "@/components/clinic/page-header";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Copy, FileText, Mail, MessageCircle, MessageSquareText, ShieldCheck, Image as ImageIcon, Loader2, MoreHorizontal, Paperclip, Pause, Phone, Play, Plus, Repeat, Settings2, Tags, Trash2, Upload, X } from "lucide-react";
import { BROADCAST_ATTACHMENT_ACCEPT, checkBroadcastAttachment } from "@/lib/broadcast-attachment";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  getClinicCloudBroadcastSetup,
  type ClinicCloudTemplate,
  retryClinicCampaignFailures,
  getClinicNextAutomatedSend,
  setRecipientCalled,
  getClinicNumberHealth,
  pauseAllClinicBroadcastCampaigns,
  resumeClinicBroadcastCampaigns,
} from "@/actions/clinic-broadcast";
import { BridgeAudiencePicker } from "@/components/clinic/bridge-audience-picker";
import { listMarcadoresAudience } from "@/actions/marcadores";
import { getTagAudience, listTagAudienceOptions } from "@/actions/tag-audience";
import type { TagAudienceOption } from "@/lib/tag-audience";
import { SELECTION_BROADCAST_KEY } from "@/components/clinic/patient-list-table";
import { buildBroadcastMessage, parseBroadcastCsv, BROADCAST_OPT_OUT_FOOTER, type ParsedBroadcastRecipient } from "@/lib/broadcast-csv";
import { estimateCampaignFinish, MARKETING_DAILY_CAP, unfilledPlaceholders, unknownTemplateVariables } from "@/lib/broadcast-schedule";
import { smsCostRange } from "@/lib/broadcast-channel";
import { RescheduleBroadcastModal } from "@/components/clinic/reschedule-broadcast-modal";
import { BroadcastPreview } from "@/components/clinic/broadcast-preview";
import { ChannelCampaignFields, ChannelConsentDialog, type ChannelSetup } from "@/components/clinic/channel-broadcast-panel";
import { getChannelSetup } from "@/actions/clinic-channel-broadcast";
import { AutomationRulesSheet } from "@/components/clinic/automation-rules-sheet";
import { TagAutomationsSheet } from "@/components/clinic/tag-automations-sheet";

type Campaign = Awaited<ReturnType<typeof listClinicBroadcastCampaigns>>[number];
type StartPreview = Awaited<ReturnType<typeof getClinicCampaignStartPreview>>;
type NumberHealthView = Awaited<ReturnType<typeof getClinicNumberHealth>>;

const FOCUS_RING = "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-950";

const HEALTH_TONE = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  danger: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
} as const;

function healthLabel(h: NumberHealthView): string {
  if (h.connection === "down") return "Número desconectado";
  if (h.onCloud) return "API oficial ativa";
  const conn = h.connection === "open" ? "Número conectado" : "Conexão não verificada";
  return `${conn} · ${h.automatedToday} mensagens automáticas hoje, ${h.automated7d} na semana`;
}
type Source = "csv" | "bridge" | "selecao" | "marcadores" | "tag";
type FormChannel = "WHATSAPP" | "SMS" | "EMAIL";
const CHANNEL_OPTIONS: { value: FormChannel; label: string; Icon: typeof Mail }[] = [
  { value: "WHATSAPP", label: "WhatsApp", Icon: MessageCircle },
  { value: "SMS", label: "SMS", Icon: MessageSquareText },
  { value: "EMAIL", label: "E-mail", Icon: Mail },
];

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
const panel = "glass-surface";

function brDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function estimateText(businessDays: number, finishIso: string | null, lateIso?: string | null): string {
  if (!finishIso) return "";
  if (lateIso) return `termina entre ${brDate(finishIso)} e ${brDate(lateIso)} (os lembretes de confirmação têm a vez)`;
  return businessDays <= 1 ? `termina ${brDate(finishIso)}` : `cerca de ${businessDays} dias úteis — termina ${brDate(finishIso)}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Faixa de custo na Comtele: R$ 0,12 (pacote de 500) a R$ 0,09 (pacote de 10 mil) por crédito. */
function smsCostText(credits: number): string {
  const { max, min } = smsCostRange(credits);
  return `cerca de ${brl(min)} a ${brl(max)}, conforme o pacote de créditos`;
}

/** Tela de Disparos (crítica 15/10/2026): campanhas no topo com a situação de cada uma
 * (enviando / fora do horário / cedendo a vez / limite do dia) e previsão de término;
 * "Nova campanha" atrás de um botão, na ordem Público → Mensagem → Imagem; Iniciar
 * sempre passa por uma confirmação com a mensagem como o 1º destinatário vai receber. */
export function BroadcastManagement() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Canal é o passo 0 de "Nova campanha" (crítica 29/10): SMS/e-mail aparecem desativados até o suporte ligar.
  const [formChannel, setFormChannel] = useState<FormChannel>("WHATSAPP");
  const [channelSetup, setChannelSetup] = useState<ChannelSetup | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tagAutomationsOpen, setTagAutomationsOpen] = useState(false);
  // "Nova campanha" em 2 etapas (crítica 02/11): 1 = nome + público, 2 = mensagem + anexo.
  // A revisão final é o diálogo de Iniciar. As etapas só escondem (hidden), não desmontam —
  // o seletor do sistema da clínica guarda estado interno.
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [channelFormKey, setChannelFormKey] = useState(0);
  const [selectionList, setSelectionList] = useState<ParsedBroadcastRecipient[]>([]);

  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");
  // Variações 2 e 3 (opcionais): cada paciente recebe um dos textos, contra bloqueio.
  const [extraVariants, setExtraVariants] = useState<string[]>(["", ""]);
  // API oficial: só modelo aprovado pela Meta; cada {{n}} recebe variável e/ou texto fixo.
  const [cloud, setCloud] = useState<{ active: boolean; templates: ClinicCloudTemplate[]; error?: string } | null>(null);
  const [cloudTemplateName, setCloudTemplateName] = useState("");
  const [cloudParams, setCloudParams] = useState<string[]>([]);
  const [csvText, setCsvText] = useState("");
  const [recipients, setRecipients] = useState<ParsedBroadcastRecipient[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [hasBridge, setHasBridge] = useState(false);
  const [marcadoresAudience, setMarcadoresAudience] = useState<ParsedBroadcastRecipient[]>([]);
  const [tagOptions, setTagOptions] = useState<TagAudienceOption[]>([]);
  const [audienceTag, setAudienceTag] = useState("");
  const [tagLoading, setTagLoading] = useState(false);
  const tagRequest = useRef(0);
  const [audienceSource, setAudienceSource] = useState<Source>("csv");
  const [pickerKey, setPickerKey] = useState(0);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const [confirming, setConfirming] = useState<{ campaign: Campaign; preview: StartPreview | null } | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
  const [nextSend, setNextSend] = useState<{ lastAt: string | null; nextAt: string | null } | null>(null);
  // Saúde do número (crítica 02/11): conexão, volume automático de hoje, queda recente.
  const [health, setHealth] = useState<NumberHealthView | null>(null);
  const [riskAck, setRiskAck] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [switchingPriority, setSwitchingPriority] = useState(false);
  const [startHealth, setStartHealth] = useState<NumberHealthView | null>(null);
  const [pausingAll, setPausingAll] = useState(false);
  const loadHealth = useCallback(() => {
    getClinicNumberHealth().then(setHealth).catch(() => {});
  }, []);

  const loadCampaigns = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setCampaigns(await listClinicBroadcastCampaigns());
      setListError(false);
      getClinicNextAutomatedSend().then(setNextSend).catch(() => {});
    } catch {
      if (!silent) setListError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadChannelSetup = useCallback(() => {
    getChannelSetup().then(setChannelSetup).catch(() => {});
  }, []);

  useEffect(() => {
    loadCampaigns();
    clinicHasBridgeAudience().then(setHasBridge).catch(() => {});
    listMarcadoresAudience().then(setMarcadoresAudience).catch(() => {});
    listTagAudienceOptions().then(setTagOptions).catch(() => {});
    getClinicCloudBroadcastSetup().then(setCloud).catch(() => {});
    loadChannelSetup();
    loadHealth();
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
          setSelectionList(parsed);
          setFormOpen(true);
        }
      } catch {
        // seleção inválida: segue com o formulário normal
      }
    }
  }, [loadCampaigns, loadChannelSetup, loadHealth]);

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
    setAudienceTag("");
    tagRequest.current++;
    setTagLoading(false);
  }

  /** Público "Por tag": busca os pacientes da tag escolhida. O contador descarta a resposta
   * de uma tag anterior que chegue depois de o usuário já ter trocado. */
  async function pickAudienceTag(tag: string) {
    setAudienceTag(tag);
    setRecipients([]);
    const request = ++tagRequest.current;
    if (!tag) {
      setTagLoading(false);
      return;
    }
    setTagLoading(true);
    try {
      const list = await getTagAudience(tag);
      if (request === tagRequest.current) setRecipients(list);
    } catch {
      if (request === tagRequest.current) toast.error("Não foi possível carregar os pacientes dessa tag. Tente de novo.");
    } finally {
      if (request === tagRequest.current) setTagLoading(false);
    }
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

  /** Anexo da campanha: imagem (com prévia) ou documento — PDF, Word, Excel (só o nome). */
  function handleImageSelect(file: File) {
    const checked = checkBroadcastAttachment({ name: file.name, type: file.type, size: file.size });
    if (!checked.ok) {
      toast.error(checked.error);
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImage(file);
    setImagePreviewUrl(checked.kind === "image" ? URL.createObjectURL(file) : null);
  }

  function handleRemoveImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImage(null);
    setImagePreviewUrl(null);
  }

  function resetForm() {
    setName("");
    setTemplate("");
    setExtraVariants(["", ""]);
    setCloudTemplateName("");
    setCloudParams([]);
    setCsvText("");
    setCsvError(null);
    setRecipients([]);
    setAudienceSource("csv");
    setPickerKey((k) => k + 1);
    handleRemoveImage();
    setFormStep(1);
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
            : audienceSource === "tag" && !audienceTag
              ? "Escolha a tag do público antes de criar a campanha."
              : "O público está vazio."
      );
      return;
    }
    setCreating(true);
    try {
      let imageFormData: FormData | undefined;
      if (image) {
        imageFormData = new FormData();
        imageFormData.set("attachment", image);
      }
      await createClinicBroadcastCampaign(
        name,
        cloudMode ? selectedTemplate?.bodyText ?? "" : template,
        recipients,
        cloudMode ? undefined : imageFormData,
        cloudMode ? [] : extraVariants,
        cloudMode ? { name: cloudTemplateName, params: cloudParams } : undefined
      );
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
    setRiskAck(false);
    setStartHealth(null);
    try {
      const preview = await getClinicCampaignStartPreview(campaign.id);
      setConfirming({ campaign, preview });
      // Saúde do número já somando esta campanha ao volume de hoje.
      getClinicNumberHealth(preview.isReschedule ? 0 : preview.pending)
        .then(setStartHealth)
        .catch(() =>
          setStartHealth({
            tone: "warn",
            reasons: ["Não foi possível conferir o número agora."],
            needsAck: true,
            blocksStart: false,
            connection: "unknown",
            onCloud: false,
            automatedToday: 0,
            automated7d: 0,
          }),
        );
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
      const started = await startClinicBroadcastCampaign(campaign.id);
      if (!started.success) {
        toast.error(started.error);
        return;
      }
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
    setDeleting(null);
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
      setFormChannel("WHATSAPP");
      setName(copy.name);
      setTemplate(copy.template);
      setExtraVariants([copy.variants[0] ?? "", copy.variants[1] ?? ""]);
      setCloudTemplateName(copy.cloudTemplateName ?? "");
      setCloudParams(copy.cloudTemplateParams ?? []);
      setAudienceSource("csv");
      setRecipients(copy.recipients);
      setCsvText("");
      setFormOpen(true);
      toast.success(
        `Cópia aberta em “Nova campanha” com ${copy.recipients.length} destinatário(s).${campaign.hasImage ? ` Anexe ${campaign.attachmentKind === "document" ? "o documento" : "a imagem"} de novo.` : ""}`
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast.error("Não foi possível duplicar.");
    } finally {
      setBusyId(null);
    }
  }

  async function retryFailures(c: Campaign) {
    setBusyId(c.id);
    try {
      const r = await retryClinicCampaignFailures(c.id, true);
      toast.success(`${plural(r.requeued, "falha voltou", "falhas voltaram")} para a fila e a campanha segue enviando no ritmo seguro.`, {
        action: {
          label: "Pausar",
          onClick: async () => {
            await pauseClinicBroadcastCampaign(c.id).catch(() => toast.error("Não foi possível pausar."));
            await loadCampaigns(true);
          },
        },
      });
      await loadCampaigns(true);
    } catch {
      toast.error("Não foi possível devolver as falhas à fila.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleLowPriority(c: Campaign): Promise<boolean> {
    try {
      await setClinicCampaignLowPriority(c.id, !c.lowPriority);
      toast.success(!c.lowPriority ? `“${c.name}” agora espera os lembretes e outras campanhas.` : `“${c.name}” volta à prioridade normal.`, {
        action: {
          label: "Desfazer",
          onClick: async () => {
            await setClinicCampaignLowPriority(c.id, c.lowPriority).catch(() => toast.error("Não foi possível desfazer."));
            await loadCampaigns(true);
          },
        },
      });
      await loadCampaigns(true);
      return true;
    } catch {
      toast.error("Não foi possível salvar.");
      return false;
    }
  }

  const sampleVars = recipients[0]?.variables ?? {};
  const columns = Object.keys(sampleVars);
  const variantCheck = template.trim() ? normalizeBroadcastVariants(template, extraVariants) : null;
  const allTexts = variantCheck?.ok ? variantCheck.variants : template.trim() ? [template] : [];
  const variantPreviews = previewBroadcastVariants(allTexts, sampleVars);
  const cloudMode = Boolean(cloud?.active);
  const selectedTemplate = cloud?.templates.find((t) => t.name === cloudTemplateName) ?? null;
  const templateProblem = cloudMode
    ? !selectedTemplate
      ? "Escolha o modelo aprovado."
      : recipients.length
        ? checkTemplateParamSources(selectedTemplate.variableCount, cloudParams, columns)
        : null
    : null;
  const builtCloud = selectedTemplate ? buildTemplateParams(cloudParams.slice(0, selectedTemplate.variableCount), sampleVars) : null;
  const cloudPreview = selectedTemplate && builtCloud?.ok ? renderTemplatePreview(selectedTemplate.bodyText, builtCloud.params) : selectedTemplate?.bodyText ?? "";
  const unknownVars = !cloudMode && recipients.length ? [...new Set(variantPreviews.flatMap((p) => p.unknownVariables))] : [];
  const unfilled = cloudMode ? [] : [...new Set(variantPreviews.flatMap((p) => p.unfilled))];
  const variantError = cloudMode ? templateProblem : variantCheck && !variantCheck.ok ? variantCheck.error : null;
  const hasMessage = cloudMode ? Boolean(selectedTemplate) : Boolean(template.trim());
  const livePreview = variantPreviews[0]?.text ?? "";
  const formEstimate = recipients.length ? estimateCampaignFinish({ pending: recipients.length, sentToday: 0, now: new Date() }) : null;
  const sourceOptions: [Source, string][] = [
    ...(audienceSource === "selecao" ? ([["selecao", `Seleção da lista de pacientes`]] as [Source, string][]) : []),
    ...(hasBridge ? ([["bridge", "Pacientes do sistema da clínica"]] as [Source, string][]) : []),
    ...(marcadoresAudience.length > 0 ? ([["marcadores", `Marcadores (${marcadoresAudience.length})`]] as [Source, string][]) : []),
    ...(tagOptions.length > 0 ? ([["tag", "Por tag"]] as [Source, string][]) : []),
    ["csv", "Colar lista / arquivo"],
  ];

  const running = campaigns.filter((c) => c.status === "RUNNING");
  const active = campaigns.filter((c) => c.status === "DRAFT" || c.status === "PAUSED");
  const done = campaigns.filter((c) => c.status === "COMPLETED");

  async function pauseAll() {
    setPausingAll(true);
    try {
      const { paused, ids } = await pauseAllClinicBroadcastCampaigns();
      if (paused) {
        toast.success(`${plural(paused, "campanha pausada", "campanhas pausadas")}. Avisos de remarcação continuam.`, {
          duration: 10000,
          action: {
            label: "Desfazer",
            onClick: async () => {
              await resumeClinicBroadcastCampaigns(ids).catch(() => toast.error("Não foi possível desfazer."));
              await loadCampaigns(true);
            },
          },
        });
      } else toast.info("Nenhuma campanha estava enviando (avisos de remarcação não são pausados aqui).");
      await loadCampaigns(true);
    } catch {
      toast.error("Não foi possível pausar. Tente de novo.");
    } finally {
      setPausingAll(false);
    }
  }

  return (
    // Visual "vidro" (09/11/2026, DESIGN.md §5): fundo em gradiente + cartões translúcidos.
    <div className="soft-canvas flex-1 min-h-0 overflow-y-auto">
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Disparos"
        subtitle={
          loading
            ? "Carregando…"
            : `${campaigns.filter((c) => c.status === "RUNNING").length} em andamento · ${plural(campaigns.filter((c) => c.status === "DRAFT" || c.status === "PAUSED").length, "rascunho ou pausada", "rascunhos ou pausadas")}`
        }
        actions={
          <div className="flex flex-wrap-reverse justify-end gap-2">
            {channelSetup?.isManager && (
              <Popover open={configOpen} onOpenChange={setConfigOpen}>
                <PopoverTrigger className={`inline-flex h-10 items-center gap-1.5 px-3.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/10 rounded-full ${FOCUS_RING}`}>
                  <Settings2 className="w-4 h-4" aria-hidden />
                  Configurar
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setConfigOpen(false);
                      setRulesOpen(true);
                    }}
                    className="w-full flex items-start gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Repeat className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                    <span>
                      Régua automática
                      <span className="block text-xs text-slate-500 dark:text-slate-400">Pós-consulta, retorno, reativação, aniversário</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfigOpen(false);
                      setTagAutomationsOpen(true);
                    }}
                    className="w-full flex items-start gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Tags className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                    <span>
                      Automações
                      <span className="block text-xs text-slate-500 dark:text-slate-400">Mensagem ou lembrete por tag ou etapa do CRM</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfigOpen(false);
                      setConsentOpen(true);
                    }}
                    className="w-full flex items-start gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                    <span>
                      Aceites SMS/e-mail
                      <span className="block text-xs text-slate-500 dark:text-slate-400">Quem autorizou receber por esses canais</span>
                    </span>
                  </button>
                </PopoverContent>
              </Popover>
            )}
            <button
              type="button"
              onClick={() => setRescheduleModalOpen(true)}
              aria-describedby="disparos-remarcacao-hint"
              className={`inline-flex h-10 items-center gap-1.5 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/80 ring-1 ring-slate-900/5 shadow-xs hover:bg-white dark:bg-white/[0.08] dark:ring-white/10 dark:hover:bg-white/[0.14] rounded-full ${FOCUS_RING}`}
            >
              <CalendarClock className="w-4 h-4" aria-hidden />
              Remarcar
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className={`inline-flex h-10 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-[0_10px_20px_-12px_rgb(5_150_105/0.9)] rounded-full ${FOCUS_RING}`}
            >
              <Plus className="w-4 h-4" aria-hidden />
              Nova campanha
            </button>
          </div>
        }
      />

      {/* Dica para quem está começando; some depois que a clínica já tem algumas campanhas. */}
      <p id="disparos-remarcacao-hint" className={campaigns.length >= 3 ? "sr-only" : "-mt-4 text-xs text-slate-500 dark:text-slate-400"}>
        <strong className="font-medium text-slate-600 dark:text-slate-300">Remarcar</strong> avisa de uma vez os pacientes agendados com ele no dia.{" "}
        {channelSetup?.isManager
          ? "Mensagens automáticas de pós-consulta, retorno e aniversário ficam em Configurar › Régua automática."
          : "Mensagens automáticas de pós-consulta e aniversário são ligadas pela gestão."}
      </p>

      {health?.tone === "danger" && (
        <div role="alert" className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50/90 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-300">
          <p className="font-semibold">O número de WhatsApp está desconectado — nenhuma campanha, lembrete ou mensagem do Chat sai agora.</p>
          <p className="mt-0.5">Reconecte o celular da clínica no WhatsApp ou fale com o suporte da Conecta Saúde. Os envios voltam sozinhos quando ele reconectar.</p>
        </div>
      )}

      {(health || running.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 -mt-2">
          {health ? (
            <details className={`group rounded-2xl border px-3 py-1.5 text-xs backdrop-blur-xl ${HEALTH_TONE[health.tone]}`}>
              <summary className={`flex items-center gap-1.5 font-medium list-none ${health.reasons.length ? "cursor-pointer" : "pointer-events-none"}`}>
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${health.tone === "ok" ? "bg-emerald-500" : health.tone === "warn" ? "bg-amber-500" : "bg-red-500"}`} />
                {healthLabel(health)}
                {health.reasons.length > 0 && health.tone !== "danger" && (
                  <span className="font-semibold underline underline-offset-2">· {plural(health.reasons.length, "motivo de atenção", "motivos de atenção")}</span>
                )}
              </summary>
              {health.reasons.length > 0 && (
                <ul className="mt-1.5 mb-0.5 list-disc pl-5 space-y-0.5 max-w-prose">
                  {health.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </details>
          ) : (
            <span />
          )}
          {running.length > 0 && (
            <button
              type="button"
              onClick={pauseAll}
              disabled={pausingAll}
              className={`inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold rounded-full border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 bg-white/80 dark:bg-white/[0.06] hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-60 ${FOCUS_RING}`}
            >
              {pausingAll ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Pause className="w-4 h-4" aria-hidden />}
              Pausar todos os envios
            </button>
          )}
        </div>
      )}

      <RescheduleBroadcastModal
        open={rescheduleModalOpen}
        onOpenChange={(next) => {
          setRescheduleModalOpen(next);
          if (!next) loadCampaigns(true);
        }}
      />

      <AutomationRulesSheet open={rulesOpen} onOpenChange={setRulesOpen} cloud={cloud} />
      <TagAutomationsSheet open={tagAutomationsOpen} onOpenChange={setTagAutomationsOpen} />
      <ChannelConsentDialog open={consentOpen} onOpenChange={setConsentOpen} setup={channelSetup} onDone={loadChannelSetup} />

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nova campanha</SheetTitle>
            <SheetDescription>Cria um rascunho — nada é enviado até você clicar em Iniciar e confirmar.</SheetDescription>
          </SheetHeader>
        <div className="px-4 pb-2 space-y-2">
          <div
            role="radiogroup"
            aria-label="Canal"
            className="grid grid-cols-3 gap-2"
            onKeyDown={(e) => {
              const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!delta) return;
              e.preventDefault();
              const idx = CHANNEL_OPTIONS.findIndex((o) => o.value === formChannel);
              const next = CHANNEL_OPTIONS[(idx + delta + CHANNEL_OPTIONS.length) % CHANNEL_OPTIONS.length].value;
              setFormChannel(next);
              (e.currentTarget.querySelector(`[data-channel="${next}"]`) as HTMLElement | null)?.focus();
            }}
          >
            {CHANNEL_OPTIONS.map(({ value, label, Icon }) => {
              const info = value === "SMS" ? channelSetup?.sms : value === "EMAIL" ? channelSetup?.email : null;
              const off = value !== "WHATSAPP" && !info?.ready;
              const selected = formChannel === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  data-channel={value}
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setFormChannel(value)}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                    selected
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className={`flex items-center gap-1.5 text-sm font-semibold ${off ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>
                    <Icon className="w-4 h-4" aria-hidden /> {label}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {value === "WHATSAPP" ? (cloudMode ? "modelo aprovado" : "texto livre") : off ? "não ativado" : plural(info?.consents ?? 0, "aceite", "aceites")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {formChannel !== "WHATSAPP" ? (
          <section className="px-4 pb-6" aria-label={`Nova campanha por ${formChannel === "SMS" ? "SMS" : "e-mail"}`}>
            {(formChannel === "SMS" ? channelSetup?.sms : channelSetup?.email)?.ready ? (
              <ChannelCampaignFields
                key={`${formChannel}-${channelFormKey}`}
                channel={formChannel}
                audiences={{ hasBridge, marcadores: marcadoresAudience, selecao: selectionList }}
                myEmail={channelSetup?.myEmail ?? ""}
                onCreated={() => {
                  setChannelFormKey((k) => k + 1);
                  setFormOpen(false);
                  loadCampaigns(true);
                }}
              />
            ) : (
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 p-4 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                <p className="font-semibold">{formChannel === "SMS" ? "SMS" : "E-mail"} ainda não foi ativado para a clínica.</p>
                <p>Fale com o suporte da Conecta Saúde para ativar. Enquanto isso, as campanhas seguem pelo WhatsApp.</p>
              </div>
            )}
          </section>
        ) : (
        <section className="px-4 space-y-5" aria-label="Nova campanha">
          <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Etapas">
            {(["Público", "Mensagem"] as const).map((label, i) => {
              const n = (i + 1) as 1 | 2;
              const current = formStep === n;
              return (
                <li key={label} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="h-px w-6 bg-slate-300 dark:bg-slate-600" />}
                  <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    onClick={() => setFormStep(n)}
                    disabled={n === 2 && (!name.trim() || recipients.length === 0)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${current ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                  >
                    <span
                      aria-hidden
                      className={`grid h-5 w-5 place-items-center rounded-full text-xs ${current ? "bg-emerald-600 text-white" : "border border-slate-300 dark:border-slate-600"}`}
                    >
                      {n}
                    </span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>

          <div hidden={formStep !== 1} className="space-y-5">
          <div>
            <label htmlFor="broadcast-name" className={labelClass}>
              Nome da campanha (só a equipe vê) <span className="text-red-600" aria-hidden>*</span>
            </label>
            <input
              id="broadcast-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Novos médicos — marcadores"
              required
              aria-required="true"
              className={inputClass}
            />
          </div>

          {/* 1. Público */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Para quem</legend>
            <div
              role="radiogroup"
              aria-label="Público"
              className="flex flex-wrap gap-2 text-sm"
              onKeyDown={(e) => {
                const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                if (!delta) return;
                e.preventDefault();
                const idx = sourceOptions.findIndex(([v]) => v === audienceSource);
                const next = sourceOptions[(idx + delta + sourceOptions.length) % sourceOptions.length][0];
                switchSource(next);
                (e.currentTarget.querySelector(`[data-source="${next}"]`) as HTMLElement | null)?.focus();
              }}
            >
              {sourceOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  data-source={value}
                  aria-checked={audienceSource === value}
                  tabIndex={audienceSource === value ? 0 : -1}
                  onClick={() => switchSource(value)}
                  className={`px-4 h-9 rounded-full font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                    audienceSource === value
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {audienceSource === "selecao" ? (
              <p className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-900 dark:text-emerald-200">
                <strong>{plural(recipients.length, "paciente selecionado", "pacientes selecionados")}</strong> na lista de pacientes.
              </p>
            ) : audienceSource === "marcadores" ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm space-y-1 text-emerald-900 dark:text-emerald-200">
                <p>
                  <strong>{plural(recipients.length, "marcador ativo", "marcadores ativos")}</strong> — cadastro em Marcadores. Use {"{{link}}"} para o link pessoal de cada um: quem
                  chegar por ele conta no relatório do marcador.
                </p>
                {!template.trim() && (
                  <button type="button" onClick={() => setTemplate(MARCADORES_TEMPLATE)} className="font-semibold underline underline-offset-2">
                    Usar modelo de aviso de novos médicos
                  </button>
                )}
              </div>
            ) : audienceSource === "tag" ? (
              <div className="space-y-1.5">
                <label htmlFor="broadcast-tag" className={labelClass}>
                  Tag dos pacientes
                </label>
                <select id="broadcast-tag" value={audienceTag} onChange={(e) => pickAudienceTag(e.target.value)} className={inputClass}>
                  <option value="">Escolha uma tag…</option>
                  {tagOptions.map((o) => (
                    <option key={o.tag} value={o.tag}>
                      {o.tag} ({o.count})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
                  {tagLoading ? (
                    "Carregando pacientes…"
                  ) : audienceTag ? (
                    <>
                      <strong className="text-emerald-700 dark:text-emerald-400">{plural(recipients.length, "paciente", "pacientes")}</strong> com essa tag
                      e telefone. Use {"{{nome}}"} ou {"{{saudacao}}"} na mensagem. Quem está como número errado fica de fora.
                    </>
                  ) : (
                    "A tag é a mesma que a recepção põe na conversa, no Chat ou no CRM."
                  )}
                </p>
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
                {csvError && (
                  <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {csvError}
                  </p>
                )}
                {recipients.length > 0 && (
                  <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">{plural(recipients.length, "contato", "contatos")} na lista.</p>
                )}
              </div>
            )}
          </fieldset>
          </div>

          <div hidden={formStep !== 2} className="space-y-5">
          {/* 2. Mensagem */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mensagem</legend>
            {cloudMode ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta clínica usa a API oficial do WhatsApp: campanhas só podem usar um modelo aprovado pela Meta. O texto é o do modelo; você escolhe o que entra
                  em cada campo {"{{1}}"}, {"{{2}}"}… Para um texto novo, crie o modelo em WhatsApp → Modelos e espere a aprovação.
                </p>
                {cloud?.error && <p className="text-sm text-red-600 dark:text-red-400">Não foi possível carregar os modelos: {cloud.error}</p>}
                <label htmlFor="broadcast-cloud-template" className={labelClass}>
                  Modelo aprovado
                </label>
                <select
                  id="broadcast-cloud-template"
                  value={cloudTemplateName}
                  onChange={(e) => {
                    setCloudTemplateName(e.target.value);
                    const t = cloud?.templates.find((x) => x.name === e.target.value);
                    setCloudParams(Array.from({ length: t?.variableCount ?? 0 }, (_, i) => (i === 0 && columns.includes("nome") ? "{{nome}}" : "")));
                  }}
                  className={inputClass}
                >
                  <option value="">{cloud?.templates.length ? "Escolha…" : "Nenhum modelo aprovado ainda"}</option>
                  {cloud?.templates.map((t) => (
                    <option key={`${t.name}-${t.language}`} value={t.name}>
                      {templateLabel(t)}
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                    <div className="whitespace-pre-wrap rounded-xl bg-slate-100 dark:bg-slate-800/60 p-3 text-sm text-slate-700 dark:text-slate-200 md:sticky md:top-0 md:self-start">
                      {selectedTemplate.bodyText.split(/(\{\{\d+\}\})/).map((part, k) =>
                        /^\{\{\d+\}\}$/.test(part) ? (
                          <mark key={k} className="rounded bg-emerald-100 px-0.5 font-semibold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">
                            {`Campo ${part.replace(/\D/g, "")}`}
                          </mark>
                        ) : (
                          part
                        ),
                      )}
                    </div>
                    <div className="space-y-2">
                    {Array.from({ length: selectedTemplate.variableCount }, (_, i) => (
                      <label key={i} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                        {`O que vai no Campo ${i + 1}`}
                        <input
                          type="text"
                          value={cloudParams[i] ?? ""}
                          onChange={(e) => setCloudParams((prev) => Array.from({ length: selectedTemplate.variableCount }, (_, j) => (j === i ? e.target.value : prev[j] ?? "")))}
                          placeholder={columns.length ? `Ex.: {{${columns[0]}}} ou um texto fixo` : "Texto fixo ou {{variável}}"}
                          className={`mt-1 ${inputClass}`}
                        />
                      </label>
                    ))}
                    {columns.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Variáveis deste público: {columns.map((c) => `{{${c}}}`).join(", ")}</p>
                    )}
                    </div>
                    </div>
                  </>
                )}
                {recipients.length > 0 && templateProblem && (
                  <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
                    {templateProblem}
                  </p>
                )}
                {selectedTemplate && (
                  <BroadcastPreview label={`Prévia${recipients[0] ? " (1º destinatário)" : ""}`}>
                    {builtCloud && !builtCloud.ok ? builtCloud.error : cloudPreview}
                  </BroadcastPreview>
                )}
              </div>
            ) : (
            <>
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
            <details className="rounded-xl bg-slate-100 dark:bg-slate-800/60 px-3 py-2" open={extraVariants.some((v) => v.trim() !== "")}>
              <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
                Variações da mensagem (opcional) — cada paciente recebe um dos textos, sorteado
              </summary>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Textos diferentes para o mesmo recado reduzem o risco de bloqueio do número. Use as mesmas variáveis da mensagem principal.
              </p>
              {extraVariants.map((v, i) => (
                <label key={i} className="mt-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Variação {i + 2}
                  <textarea
                    rows={4}
                    value={v}
                    onChange={(e) => setExtraVariants((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                    placeholder="Mesmo recado, com outras palavras…"
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-y"
                  />
                </label>
              ))}
            </details>
            {variantError && (
              <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
                {variantError}
              </p>
            )}
            {columns.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Inserir:</span>
                {columns.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => insertVariable(c)}
                    className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {`{{${c}}}`}
                  </button>
                ))}
              </div>
            )}
            {unknownVars.length > 0 && (
              <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
                {unknownVars.map((v) => `{{${v}}}`).join(", ")} não existe neste público — o paciente receberia o texto entre chaves. Corrija antes de
                criar.
              </p>
            )}
            {unfilled.length > 0 && (
              <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
                Preencha antes de criar: {unfilled.join(", ")}.
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toda mensagem termina com “{BROADCAST_OPT_OUT_FOOTER}” — quem responder 9 não recebe mais campanhas.
            </p>
            {livePreview &&
              variantPreviews.map((p, i) => (
                <BroadcastPreview
                  key={i}
                  label={`Prévia${variantPreviews.length > 1 ? ` — ${i === 0 ? "mensagem principal" : `variação ${i + 1}`}` : ""}${recipients[0] ? " (1º destinatário)" : ""}`}
                >
                  {p.text}
                </BroadcastPreview>
              ))}
            </>
            )}
          </fieldset>

          {/* 3. Anexo: imagem ou documento (texto livre; o modelo da API oficial não leva anexo) */}
          {!cloudMode && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Anexo (opcional)</legend>
            {image ? (
              <div className="flex items-center gap-3">
                {imagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreviewUrl} alt="Prévia da imagem da campanha" className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-800" />
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 px-3 py-2 min-w-0">
                    <FileText className="w-6 h-6 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {(() => {
                          const checked = checkBroadcastAttachment({ name: image.name, type: image.type, size: image.size });
                          return checked.ok ? checked.fileName : image.name;
                        })()}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{(image.size / 1024 / 1024).toFixed(1)} MB · o paciente recebe com este nome</p>
                    </div>
                  </div>
                )}
                <button type="button" onClick={handleRemoveImage} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                  <X className="w-4 h-4" aria-hidden /> Remover
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500/50 rounded-md px-1">
                  <Paperclip className="w-4 h-4" aria-hidden /> Anexar imagem ou documento
                  <input
                    type="file"
                    accept={BROADCAST_ATTACHMENT_ACCEPT}
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                  />
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Imagem, PDF, Word ou Excel (por exemplo, uma tabela de valores), até 15 MB. A mensagem acima vai junto, como legenda.
                </p>
              </div>
            )}
          </fieldset>
          )}
          </div>

          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur px-4 py-3">
            <p id="broadcast-footer-status" className="text-sm text-slate-600 dark:text-slate-300 min-w-0 flex-1">
              {formStep === 2 && unknownVars.length > 0
                ? <span className="text-red-700 dark:text-red-400">Corrija as variáveis que não existem: {unknownVars.map((v) => `{{${v}}}`).join(", ")}.</span>
                : formStep === 2 && unfilled.length > 0
                ? <span className="text-red-700 dark:text-red-400">Preencha: {unfilled.join(", ")}.</span>
                : formStep === 2 && variantError
                ? <span className="text-red-700 dark:text-red-400">{variantError}</span>
                : formStep === 1
                ? !name.trim()
                  ? "Falta dar um nome à campanha."
                  : recipients.length
                    ? `${plural(recipients.length, "destinatário", "destinatários")}${formEstimate ? ` · ${estimateText(formEstimate.businessDays, formEstimate.finishIso)} se começar agora` : ""}.`
                    : "Escolha o público."
                : !name.trim()
                ? "Falta dar um nome à campanha."
                : !hasMessage
                  ? cloudMode ? "Falta escolher o modelo." : "Falta escrever a mensagem."
                  : formEstimate
                ? `${plural(recipients.length, "destinatário", "destinatários")} · envio seguro: 1 a cada 4–6 min, seg–sex 9h–17h, até ${MARKETING_DAILY_CAP}/dia — ${estimateText(formEstimate.businessDays, formEstimate.finishIso)} se começar agora.`
                : "Escolha o público para ver a previsão de envio."}
            </p>
            {formStep === 1 ? (
              <button
                type="button"
                disabled={!name.trim() || recipients.length === 0}
                aria-describedby="broadcast-footer-status"
                onClick={() => setFormStep(2)}
                className={`inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-full ${FOCUS_RING}`}
              >
                Continuar
              </button>
            ) : (
            <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormStep(1)}
              className={`h-9 px-3 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 ${FOCUS_RING}`}
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={creating || unknownVars.length > 0 || unfilled.length > 0 || Boolean(variantError) || !name.trim() || !hasMessage}
              aria-describedby="broadcast-footer-status"
              onClick={handleCreate}
              className={`inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-full ${FOCUS_RING}`}
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              Criar rascunho
            </button>
            </div>
            )}
          </div>
        </section>
        )}
        </SheetContent>
      </Sheet>

      <section className="space-y-3" aria-labelledby="campaigns-title">
        <h2 id="campaigns-title" className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Campanhas
        </h2>
        {loading ? (
          <div className={`${panel} p-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2`}>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…
          </div>
        ) : listError ? (
          <div role="alert" className="rounded-[1.75rem] border border-red-300 dark:border-red-800 bg-red-50/90 dark:bg-red-950/40 p-5 text-sm text-red-800 dark:text-red-300">
            Não foi possível carregar as campanhas — as que existem não aparecem aqui.{" "}
            <button type="button" onClick={() => loadCampaigns()} className="font-semibold underline underline-offset-2">
              Tentar de novo
            </button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className={`${panel} p-6 text-center text-sm text-slate-500 dark:text-slate-400`}>
            Nenhuma campanha ainda. Clique em “Nova campanha” para começar.
          </div>
        ) : (
          <>
            {running.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Enviando agora</h3>
                {nextSend?.nextAt && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Próxima mensagem automática da clínica por volta de{" "}
                    {new Date(Math.max(Date.parse(nextSend.nextAt), Date.now())).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" })} —
                    lembretes, avisos e campanhas saem um de cada vez, a cada 4–6 min.
                  </p>
                )}
                {running.map((c) => (
                  <CampaignCard
                    key={c.id}
                    c={c}
                    busy={busyId === c.id}
                    onStart={() => askStart(c)}
                    onPause={() => pause(c)}
                    onDelete={() => setDeleting(c)}
                    onDuplicate={() => duplicate(c)}
                    onRetry={() => retryFailures(c)}
                    onToggleLowPriority={() => toggleLowPriority(c)}
                  />
                ))}
              </div>
            )}
            {active.length > 0 && <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400 pt-1">Rascunhos e pausadas</h3>}
            {active.map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                busy={busyId === c.id}
                onStart={() => askStart(c)}
                onPause={() => pause(c)}
                onDelete={() => setDeleting(c)}
                onDuplicate={() => duplicate(c)}
                onRetry={() => retryFailures(c)}
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
                      onRetry={() => retryFailures(c)}
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
            <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Montando a prévia…
            </p>
          ) : (
            <div className="space-y-4">
              {/* Risco primeiro (crítica 02/11 #2): o que pode bloquear o número vem antes da prévia. */}
              {confirming.preview.channel === "WHATSAPP" && !confirming.preview.isReschedule &&
                (!startHealth ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500" role="status">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Conferindo o número…
                  </p>
                ) : (
                  <div role={startHealth.tone === "ok" ? "status" : "alert"} className={`rounded-lg border p-3 text-sm space-y-2 ${HEALTH_TONE[startHealth.tone]}`}>
                    <p className="font-semibold">{healthLabel(startHealth)}</p>
                    {startHealth.reasons.length > 0 && (
                      <ul className="list-disc pl-5 space-y-0.5">
                        {startHealth.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                    {startHealth.needsAck && (
                      <>
                        <p>
                          Se o WhatsApp bloquear o número, <strong>os lembretes de confirmação e o Chat param</strong> até ele voltar — em outubro isso levou dias.
                        </p>
                        {!confirming.preview.lowPriority && (
                          <button
                            type="button"
                            disabled={switchingPriority}
                            onClick={async () => {
                              const c = confirming.campaign;
                              const preview = confirming.preview!;
                              setSwitchingPriority(true);
                              const ok = await toggleLowPriority(c);
                              setSwitchingPriority(false);
                              // Só marca na prévia se o servidor confirmou (crítica 02/11, 6ª).
                              if (ok) setConfirming({ campaign: { ...c, lowPriority: true }, preview: { ...preview, lowPriority: true } });
                            }}
                            className={`inline-flex items-center gap-1.5 font-semibold underline underline-offset-2 disabled:opacity-60 ${FOCUS_RING}`}
                          >
                            {switchingPriority && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
                            Mais seguro: mudar para baixa prioridade (cede a vez aos lembretes)
                          </button>
                        )}
                        <label className="flex items-start gap-2 font-medium">
                          <input type="checkbox" checked={riskAck} onChange={(e) => setRiskAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-600" />
                          Entendo que o número pode ser bloqueado e quero iniciar mesmo assim
                        </label>
                      </>
                    )}
                  </div>
                ))}
              {confirming.preview.isReschedule ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Aviso de remarcação para <strong>{plural(confirming.preview.pending, "paciente", "pacientes")}</strong>: 1 a cada 4–6 min, das 8h às 18h,
                    todo dia (por ser urgente, usa uma janela maior que a das campanhas)
                    {confirming.preview.urgentLastAt
                      ? ` — o último recebe por volta de ${new Date(confirming.preview.urgentLastAt).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" })}`
                      : ""}
                    .
                  </p>
                  {confirming.preview.needsCall.filter((n) => !n.called).length > 0 && (
                    <p className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-800 dark:text-red-300">
                      {plural(confirming.preview.needsCall.filter((n) => !n.called).length, "paciente ainda precisa", "pacientes ainda precisam")} de ligação —
                      a lista fica no card da campanha.
                    </p>
                  )}
                </div>
              ) : confirming.preview.channel !== "WHATSAPP" ? (
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  <p>
                    Vai para <strong>{plural(confirming.preview.pending, "endereço", "endereços")}</strong> por{" "}
                    {confirming.preview.channel === "SMS" ? "SMS" : "e-mail"}, em lotes, de segunda a sexta das 9h às 17h.
                    {confirming.preview.smsCredits
                      ? ` Cada SMS consome ${plural(confirming.preview.smsCredits, "crédito", "créditos")} — até ${plural(confirming.preview.smsCredits * (confirming.preview.withConsent ?? 0), "crédito", "créditos")} no total (só quem tem aceite recebe), ${smsCostText(confirming.preview.smsCredits * (confirming.preview.withConsent ?? 0))}.`
                      : ""}
                  </p>
                  <p
                    className={
                      (confirming.preview.withConsent ?? 0) < confirming.preview.pending
                        ? "rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2 text-amber-900 dark:text-amber-200"
                        : ""
                    }
                  >
                    <strong>{plural(confirming.preview.withConsent ?? 0, "tem", "têm")}</strong> aceite deste canal.
                    {(confirming.preview.withConsent ?? 0) < confirming.preview.pending
                      ? " Os demais serão pulados e aparecem como “Sem consentimento”. A gestão registra os aceites no botão “Aceites SMS/e-mail”, no topo da página."
                      : ""}
                  </p>
                </div>
              ) : (
              <div className="text-sm text-slate-700 dark:text-slate-200">
                <p>
                  <strong>{plural(confirming.preview.pending, "pessoa", "pessoas")}</strong> · {estimateText(confirming.preview.businessDays, confirming.preview.finishIso)}
                  {confirming.preview.lowPriority ? " · baixa prioridade" : ""}
                </p>
                <details className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <summary className="cursor-pointer">Como é o ritmo</summary>
                  <p className="mt-1">
                    Uma mensagem a cada 4–6 min, de segunda a sexta das 9h às 17h, até {MARKETING_DAILY_CAP} por dia.
                    {confirming.preview.lowPriority
                      ? " Baixa prioridade espera os lembretes e outras campanhas, então pode demorar mais."
                      : confirming.preview.remindersOn
                        ? " Os lembretes de confirmação têm a vez nas manhãs, então pode terminar um pouco depois."
                        : ""}
                  </p>
                </details>
              </div>
              )}
              <BroadcastPreview tall label={`Como chega para o 1º destinatário${confirming.preview.samplePhone ? ` (${confirming.preview.samplePhone})` : ""}:`}>
                  {confirming.preview.hasImage && (
                    <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                      [{confirming.preview.attachmentKind === "document" ? `documento anexado: ${confirming.preview.attachmentName ?? "arquivo"}` : "imagem anexada"}]
                    </p>
                  )}
                  {confirming.preview.sampleMessage}
              </BroadcastPreview>
              {confirming.preview.variantMessages.length > 1 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                    Ver as {confirming.preview.variantMessages.length} variações (cada paciente recebe uma)
                  </summary>
                  {confirming.preview.variantMessages.slice(1).map((m, i) => (
                    <div key={i} className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-100 dark:bg-slate-800/60 p-3 text-slate-900 dark:text-slate-100">
                      <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Variação {i + 2}</p>
                      {m}
                    </div>
                  ))}
                </details>
              )}
              {(confirming.preview.unknownVariables.length > 0 || confirming.preview.unfilled.length > 0) && (
                <div role="alert" className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-300 space-y-2">
                  <p>
                    O texto tem trechos que sairiam assim para o paciente:{" "}
                    <strong>{[...confirming.preview.unknownVariables.map((v) => `{{${v}}}`), ...confirming.preview.unfilled].join(", ")}</strong>. Não dá para
                    iniciar.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const c = confirming.campaign;
                      setConfirming(null);
                      duplicate(c);
                    }}
                    className="font-semibold underline underline-offset-2"
                  >
                    Duplicar e corrigir o texto
                  </button>
                </div>
              )}
              {confirming.preview.missingTechnicalDirector && (
                <div role="alert" className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
                  Falta o responsável técnico (nome e CRM), exigido pelo CFM em campanhas. A gestão cadastra em{" "}
                  <a href="/clinic/precos" className="font-semibold underline underline-offset-2">Configurações › Preços e parâmetros</a>.
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className={`h-9 px-4 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 ${FOCUS_RING}`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    busyId === confirming.campaign.id ||
                    confirming.preview.pending === 0 ||
                    (confirming.preview.channel !== "WHATSAPP" && (confirming.preview.withConsent ?? 0) === 0) ||
                    confirming.preview.unknownVariables.length > 0 ||
                    confirming.preview.unfilled.length > 0 ||
                    confirming.preview.missingTechnicalDirector ||
                    (confirming.preview.channel === "WHATSAPP" &&
                      !confirming.preview.isReschedule &&
                      (!startHealth || startHealth.blocksStart || (startHealth.needsAck && !riskAck)))
                  }
                  onClick={confirmStart}
                  className={`inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white disabled:opacity-50 rounded-lg ${
                    startHealth?.needsAck && confirming.preview.channel === "WHATSAPP" ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {busyId === confirming.campaign.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Play className="w-4 h-4" aria-hidden />}
                  {startHealth?.needsAck && confirming.preview.channel === "WHATSAPP" ? "Iniciar mesmo assim" : "Iniciar envio"} para {confirming.preview.pending}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir o rascunho “{deleting?.name}”?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-300">Nada foi enviado. A lista de destinatários e o texto deste rascunho serão apagados.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className={`h-9 px-4 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 ${FOCUS_RING}`}
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => deleting && removeDraft(deleting)}
              className={`inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg ${FOCUS_RING}`}
            >
              <Trash2 className="w-4 h-4" aria-hidden /> Excluir rascunho
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
  onRetry,
  onToggleLowPriority,
}: {
  c: Campaign;
  busy: boolean;
  onStart: () => void;
  onPause: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRetry: () => void;
  onToggleLowPriority: () => void;
}) {
  const [calls, setCalls] = useState(c.needsCall);
  useEffect(() => setCalls(c.needsCall), [c.needsCall]);
  const [moreOpen, setMoreOpen] = useState(false);
  async function toggleCalled(id: string, called: boolean) {
    setCalls((prev) => prev.map((x) => (x.id === id ? { ...x, called } : x)));
    try {
      await setRecipientCalled(id, called);
    } catch {
      setCalls((prev) => prev.map((x) => (x.id === id ? { ...x, called: !called } : x)));
      toast.error("Não foi possível salvar.");
    }
  }
  const pendingCalls = calls.filter((x) => !x.called).length;
  // Falha não conta como progresso (não chegou ao paciente).
  const progress = c.total ? Math.round(((c.sent + c.skipped + c.noConsent) / c.total) * 100) : 0;
  const actionBtn =
    "inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium rounded-full bg-white/80 ring-1 ring-slate-900/5 shadow-xs hover:bg-white dark:bg-white/[0.08] dark:ring-white/10 dark:hover:bg-white/[0.14] text-slate-700 dark:text-slate-200 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";
  return (
    <article
      className={`glass-surface p-5 space-y-3 ${
        c.status === "RUNNING" ? "ring-2 ring-emerald-400/60 dark:ring-emerald-700/70" : ""
      }`}
      aria-label={c.name}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{c.name}</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            {c.channel !== "WHATSAPP" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300">
                {c.channel === "SMS" ? "SMS" : "E-mail"}
              </span>
            )}
            {c.hasImage &&
              (c.attachmentKind === "document" ? (
                <FileText role="img" className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" aria-label={`Com documento${c.attachmentName ? `: ${c.attachmentName}` : ""}`} />
              ) : (
                <ImageIcon role="img" className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" aria-label="Com imagem" />
              ))}
          </div>
          {c.status === "RUNNING" && (
          <p className={`mt-1 text-sm font-medium ${SITUATION_CLASS[c.situation.tone]}`}>
            {c.situation.text}
            {c.isReschedule && c.urgentLastAt ? (
              <span className="font-normal text-slate-500 dark:text-slate-400">
                {" "}
                · o último recebe por volta de{" "}
                {new Date(c.urgentLastAt).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" })}
              </span>
            ) : (
              c.finishIso && <span className="font-normal text-slate-500 dark:text-slate-400"> · {estimateText(c.businessDays, c.finishIso, c.finishLateIso)}</span>
            )}
          </p>
          )}
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
              className={`inline-flex h-8 items-center gap-1.5 px-3 text-xs font-semibold rounded-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 ${FOCUS_RING}`}
              aria-label={`${c.status === "PAUSED" ? "Retomar" : "Iniciar"} ${c.name}`}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Play className="w-3.5 h-3.5" aria-hidden />}
              {c.status === "PAUSED" ? "Retomar" : "Iniciar"}
            </button>
          ) : null}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger className={actionBtn} aria-label={`Mais ações de ${c.name}`}>
              <MoreHorizontal className="w-4 h-4" aria-hidden /> Mais
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMoreOpen(false);
                  onDuplicate();
                }}
                className="w-full flex items-center gap-2 rounded-md px-2 h-9 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Copy className="w-4 h-4" aria-hidden /> Duplicar
              </button>
              {c.status !== "COMPLETED" && !c.isReschedule && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onToggleLowPriority();
                  }}
                  className="w-full flex items-center gap-2 rounded-md px-2 h-9 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <CalendarClock className="w-4 h-4" aria-hidden />
                  {c.lowPriority ? "Voltar à prioridade normal" : "Mudar para baixa prioridade"}
                </button>
              )}
              {c.status === "DRAFT" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMoreOpen(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2 rounded-md px-2 h-9 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="w-4 h-4" aria-hidden /> Excluir rascunho
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div>
        <div className="h-2 w-full rounded-full bg-slate-900/[0.06] dark:bg-white/[0.08] overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso do envio de ${c.name}`}>
          <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        {/* Crítica 02/11: a linha "a · b · c…" de até 8 itens virou células com rótulo. */}
        <dl className={`mt-2 grid grid-cols-2 gap-2 text-xs ${c.noConsent > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          {(
            [
              { label: "Enviadas", value: `${c.sent} de ${c.total}`, tone: "" },
              { label: "Na fila", value: c.status === "DRAFT" ? "—" : String(c.pending), tone: "" },
              {
                label: "Saíram da lista",
                value: String(c.skipped),
                tone: "",
                hint: c.skipped > 0 ? "pediram para não receber" : undefined,
              },
              ...(c.noConsent > 0 ? [{ label: "Sem aceite", value: String(c.noConsent), tone: "", hint: "não autorizaram campanhas" }] : []),
              { label: "Falhas", value: String(c.failed), tone: c.failed > 0 ? "text-red-700 dark:text-red-400" : "" },
            ] as { label: string; value: string; tone: string; hint?: string }[]
          ).map((s) => (
            <div key={s.label} className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5">
              <dt className="text-slate-500 dark:text-slate-400">{s.label}</dt>
              <dd className={`text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 ${s.tone}`}>{s.value}</dd>
              {s.hint && <dd className="text-xs leading-tight text-slate-600 dark:text-slate-300">{s.hint}</dd>}
            </div>
          ))}
        </dl>
        {c.delivery && c.sent > 0 && (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            E-mail: {c.delivery.delivered} entregue{c.delivery.delivered === 1 ? "" : "s"}
            {c.delivery.bounced > 0 && <span className="text-amber-700 dark:text-amber-400">{` · ${c.delivery.bounced} voltaram (e-mail inexistente ou cheio)`}</span>}
            {c.delivery.complained > 0 && <span className="text-red-700 dark:text-red-400">{` · ${c.delivery.complained} marcaram como spam (saíram da lista)`}</span>}
          </p>
        )}
        {c.sentByVariant && (
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-slate-600 dark:text-slate-400">Enviadas por texto</summary>
            <p className="mt-0.5 text-slate-600 dark:text-slate-400 tabular-nums">
              {c.sentByVariant.map((n, i) => `${i === 0 ? "principal" : `variação ${i + 1}`} ${n}`).join(" · ")}
            </p>
          </details>
        )}
        {c.failed > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer font-medium text-red-700 dark:text-red-400">Ver falhas</summary>
            <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-300">
              {c.failures.map((f, i) => (
                <li key={i} className="tabular-nums">
                  {f.name ? (
                    <>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{f.name}</span> · {f.phone}
                    </>
                  ) : (
                    f.phone
                  )}{" "}
                  — {f.reason ?? "motivo não informado"}
                </li>
              ))}
              {c.failed > c.failures.length && <li>…e mais {c.failed - c.failures.length}</li>}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={onRetry}
              className="mt-2 inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium rounded-full bg-white/80 ring-1 ring-slate-900/5 shadow-xs hover:bg-white dark:bg-white/[0.08] dark:ring-white/10 dark:hover:bg-white/[0.14] text-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              Devolver falhas à fila e retomar
            </button>
          </details>
        )}
      </div>

      {c.status !== "COMPLETED" && c.lowPriority && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Baixa prioridade: espera os lembretes e outras campanhas.</p>
      )}

      {c.isReschedule && calls.length > 0 && (
        <section
          className={`rounded-md border p-3 text-sm ${
            pendingCalls > 0
              ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Pacientes que precisam de ligação"
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <Phone className="w-4 h-4" aria-hidden />
            {pendingCalls > 0 ? `Precisam de ligação (${pendingCalls} de ${calls.length})` : `Ligações feitas (${calls.length})`}
          </p>
          <p className="mt-0.5 text-xs opacity-90">Não recebem a mensagem antes da consulta, ou estão sem horário. Marque quando ligar.</p>
          <ul className="mt-2 space-y-1">
            {calls.map((x) => (
              <li key={x.id}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={x.called} onChange={() => toggleCalled(x.id, !x.called)} className="size-4 accent-emerald-600" />
                  <span className={`tabular-nums ${x.called ? "line-through opacity-60" : ""}`}>
                    {x.reason === "no_time" ? "sem horário" : x.horario} — {x.name} — {x.phone}
                  </span>
                  <span className="sr-only">{x.called ? "ligação feita" : "precisa de ligação"}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Megaphone, Loader2, Play, Pause, Upload, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import {
  listBroadcastCampaigns,
  createBroadcastCampaign,
  startBroadcastCampaign,
  pauseBroadcastCampaign,
} from "@/actions/admin-broadcast";
import { parseBroadcastCsv, BROADCAST_OPT_OUT_FOOTER, type ParsedBroadcastRecipient } from "@/lib/broadcast-csv";

type ClinicOption = { id: string; tradeName: string };
type Campaign = Awaited<ReturnType<typeof listBroadcastCampaigns>>[number];

const STATUS_LABEL: Record<Campaign["status"], string> = {
  DRAFT: "Rascunho",
  RUNNING: "Em andamento",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
};

const STATUS_CLASS: Record<Campaign["status"], string> = {
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  RUNNING: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  PAUSED: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  COMPLETED: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
};

export function BroadcastManagement({ clinics }: { clinics: ClinicOption[] }) {
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");
  const [csvText, setCsvText] = useState("");
  const [recipients, setRecipients] = useState<ParsedBroadcastRecipient[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  async function loadCampaigns(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      setCampaigns(await listBroadcastCampaigns(id));
    } catch {
      toast.error("Erro ao carregar campanhas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns(clinicId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

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
      setCsvError(error instanceof Error ? error.message : "CSV inválido.");
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

  async function handleCreate() {
    if (!clinicId) return;
    if (recipients.length === 0) {
      toast.error("Cole ou envie um CSV válido antes de criar a campanha.");
      return;
    }
    setCreating(true);
    try {
      let imageFormData: FormData | undefined;
      if (image) {
        imageFormData = new FormData();
        imageFormData.set("image", image);
      }
      await createBroadcastCampaign(clinicId, name, template, recipients, imageFormData);
      toast.success("Campanha criada como rascunho. Clique em Iniciar quando estiver pronto.");
      setName("");
      setTemplate("");
      setCsvText("");
      setRecipients([]);
      handleRemoveImage();
      await loadCampaigns(clinicId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar campanha.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(campaign: Campaign) {
    setTogglingId(campaign.id);
    try {
      if (campaign.status === "RUNNING") {
        await pauseBroadcastCampaign(campaign.id);
      } else {
        await startBroadcastCampaign(campaign.id);
      }
      await loadCampaigns(clinicId);
    } catch {
      toast.error("Erro ao atualizar campanha.");
    } finally {
      setTogglingId(null);
    }
  }

  const csvColumns = recipients[0] ? Object.keys(recipients[0].variables) : [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Disparo de mensagens</h1>
      </div>

      <div>
        <label htmlFor="broadcast-clinic" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Clínica
        </label>
        <select
          id="broadcast-clinic"
          value={clinicId}
          onChange={(e) => setClinicId(e.target.value)}
          className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
        >
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>{c.tradeName}</option>
          ))}
        </select>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Nova campanha</h2>

        <div>
          <label htmlFor="broadcast-name" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Nome da campanha
          </label>
          <input
            id="broadcast-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Aviso de horário especial - Setembro"
            className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>

        <div>
          <label htmlFor="broadcast-template" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Mensagem
          </label>
          <textarea
            id="broadcast-template"
            rows={4}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder={"Ex: Olá {{nome}}, sua consulta de {{procedimento}} está confirmada."}
            className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
          />
          {csvColumns.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Variáveis disponíveis: {csvColumns.map((c) => `{{${c}}}`).join(", ")}
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Toda mensagem sai com um aviso de opt-out no final: &quot;{BROADCAST_OPT_OUT_FOOTER}&quot;
          </p>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Imagem (opcional)
          </label>
          {imagePreviewUrl ? (
            <div className="mt-1 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviewUrl} alt="Prévia da imagem da campanha" className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-800" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400"
              >
                <X className="w-3.5 h-3.5" /> Remover
              </button>
            </div>
          ) : (
            <label className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-700 dark:text-violet-300 cursor-pointer">
              <ImageIcon className="w-3.5 h-3.5" /> Anexar imagem
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
              />
            </label>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="broadcast-csv" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Lista de contatos (CSV — vírgula ou ponto-e-vírgula, cabeçalho opcional)
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-700 dark:text-violet-300 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Enviar arquivo
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
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
            className="w-full mt-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
          />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Sem cabeçalho, assume a ordem telefone, nome, procedimento, data. Com cabeçalho, qualquer
            coluna extra vira variável — só a coluna de telefone precisa se chamar &quot;telefone&quot; ou &quot;phone&quot;.
          </p>
          {csvError && <p className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">{csvError}</p>}
          {recipients.length > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              {recipients.length} destinatário(s) reconhecido(s).
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={creating}
          onClick={handleCreate}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl transition-all"
        >
          {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {creating ? "Criando..." : "Criar campanha (rascunho)"}
        </button>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Campanhas</h2>
        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma campanha criada pra essa clínica ainda.</p>
        ) : (
          campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">{c.name}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_CLASS[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                  {c.hasImage && <ImageIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {c.sent}/{c.total} enviados
                  {c.failed > 0 && ` · ${c.failed} falha(s)`}
                  {c.skipped > 0 && ` · ${c.skipped} já tinham saído (opt-out)`}
                </p>
              </div>

              {c.status !== "COMPLETED" && (
                <button
                  type="button"
                  disabled={togglingId === c.id}
                  onClick={() => handleToggle(c)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  {togglingId === c.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : c.status === "RUNNING" ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {c.status === "RUNNING" ? "Pausar" : "Iniciar"}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

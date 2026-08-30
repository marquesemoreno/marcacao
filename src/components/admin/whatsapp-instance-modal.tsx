"use client";

import { useCallback, useRef, useState } from "react";
import type { WhatsappInstanceStatus } from "@prisma/client";
import { QrCode, RefreshCw, Power, Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getWhatsappInstance,
  saveWhatsappInstanceConfig,
  getQrCodeForInstance,
  testConnection,
  restartInstance,
  disconnectInstance,
} from "@/actions/admin-whatsapp-instance";

type Status = WhatsappInstanceStatus;

type InstanceState = {
  apiUrl: string;
  apiKeyMasked: string;
  instanceName: string;
  status: Status;
  lastCheckedAt: Date | string | null;
};

const STATUS_LABEL: Record<Status, string> = {
  CONNECTED: "Conectado",
  CONNECTING: "Conectando",
  DISCONNECTED: "Desconectado",
};

const STATUS_STYLE: Record<Status, string> = {
  CONNECTED: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  CONNECTING: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  DISCONNECTED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

export function WhatsappInstanceModal({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [instance, setInstance] = useState<InstanceState | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  async function loadInstance() {
    setLoading(true);
    try {
      const data = await getWhatsappInstance(clinicId);
      setInstance(data);
      if (data) {
        setApiUrl(data.apiUrl);
        setInstanceName(data.instanceName);
      }
    } catch {
      toast.error("Erro ao carregar configuração do WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      loadInstance();
    } else {
      stopPolling();
      setQrCode(null);
      setApiKey("");
    }
  }

  async function handleSave() {
    if (!apiUrl || !instanceName) {
      toast.error("Preencha a URL e o nome da instância.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveWhatsappInstanceConfig(clinicId, { apiUrl, apiKey, instanceName });
      if (result.success) {
        toast.success("Instância configurada! Agora gere o QR Code para conectar.");
        setApiKey("");
        await loadInstance();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  }

  function startPollingStatus() {
    stopPolling();
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const result = await testConnection(clinicId);
      if (result.success) {
        setInstance((prev) => (prev ? { ...prev, status: result.status } : prev));
        if (result.status === "CONNECTED") {
          stopPolling();
          setQrCode(null);
          toast.success("WhatsApp conectado com sucesso!");
        }
      }
      if (attempts >= 20) stopPolling(); // ~1 minuto de tentativas
    }, 3000);
  }

  async function handleGenerateQrCode() {
    setActionLoading("qrcode");
    try {
      const result = await getQrCodeForInstance(clinicId);
      if (result.success) {
        if (!result.base64) {
          toast.error("A Evolution API não retornou um QR Code. Tente reiniciar a instância.");
        } else {
          setQrCode(result.base64);
          setInstance((prev) => (prev ? { ...prev, status: "CONNECTING" } : prev));
          startPollingStatus();
        }
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Erro ao gerar QR Code.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTestConnection() {
    setActionLoading("test");
    try {
      const result = await testConnection(clinicId);
      if (result.success) {
        setInstance((prev) => (prev ? { ...prev, status: result.status } : prev));
        toast.success(`Status atual: ${STATUS_LABEL[result.status]}`);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Erro ao testar conexão.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRestart() {
    setActionLoading("restart");
    try {
      const result = await restartInstance(clinicId);
      if (result.success) {
        toast.success("Instância reiniciada. Aguarde alguns segundos e teste a conexão.");
        setInstance((prev) => (prev ? { ...prev, status: "CONNECTING" } : prev));
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Erro ao reiniciar instância.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDisconnect() {
    setActionLoading("disconnect");
    try {
      const result = await disconnectInstance(clinicId);
      if (result.success) {
        toast.success("Instância desconectada.");
        setInstance((prev) => (prev ? { ...prev, status: "DISCONNECTED" } : prev));
        setQrCode(null);
        stopPolling();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Erro ao desconectar instância.");
    } finally {
      setActionLoading(null);
    }
  }

  const status = instance?.status ?? "DISCONNECTED";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex items-center justify-center w-9 h-9 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 rounded-xl transition-all cursor-pointer"
        title="Instância WhatsApp"
        aria-label="Instância WhatsApp"
      >
        <WhatsAppIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <WhatsAppIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            WhatsApp exclusivo — {clinicName}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Instância própria da Evolution API para o atendimento humano desta clínica —
            separada do número compartilhado do marketplace. Agendamentos e lembretes
            automáticos continuam saindo pelo número global.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${STATUS_STYLE[status]}`}
            >
              {status === "CONNECTED" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : status === "CONNECTING" ? (
                <Circle className="w-3.5 h-3.5 animate-pulse" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              {STATUS_LABEL[status]}
              {instance?.lastCheckedAt && (
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  · verificado {new Date(instance.lastCheckedAt).toLocaleTimeString("pt-BR")}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="wa-api-url" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  URL Base da Evolution API
                </label>
                <input
                  id="wa-api-url"
                  type="text"
                  placeholder="https://evolution.exemplo.com.br"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
              <div>
                <label htmlFor="wa-api-key" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  API Key
                </label>
                <input
                  id="wa-api-key"
                  type="password"
                  placeholder={
                    instance ? `Preenchida (${instance.apiKeyMasked}) — deixe em branco para manter` : "Cole a API Key da instância"
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
              <div>
                <label htmlFor="wa-instance-name" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Nome da Instância
                </label>
                <input
                  id="wa-instance-name"
                  type="text"
                  placeholder="ex: santa-clara"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl transition-all"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? "Salvando..." : "Salvar Credenciais"}
              </button>
            </div>

            {instance && (
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {qrCode && (
                  <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="QR Code para conectar o WhatsApp" className="w-48 h-48" />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium text-center">
                      Abra o WhatsApp no celular da clínica → Aparelhos conectados → Conectar um aparelho
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={handleGenerateQrCode}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 disabled:opacity-50 rounded-xl transition-all"
                  >
                    {actionLoading === "qrcode" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <QrCode className="w-3.5 h-3.5" />
                    )}
                    Gerar QR Code
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={handleTestConnection}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-all"
                  >
                    {actionLoading === "test" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Testar Conexão
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={handleRestart}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-200 dark:border-amber-800 disabled:opacity-50 rounded-xl transition-all"
                  >
                    {actionLoading === "restart" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Reiniciar
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={handleDisconnect}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-800 disabled:opacity-50 rounded-xl transition-all"
                  >
                    {actionLoading === "disconnect" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                    Desconectar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

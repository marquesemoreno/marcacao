"use client";

import { useState } from "react";
import { Building2, RefreshCw, Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getHospitalIntegration,
  saveHospitalIntegrationConfig,
  toggleHospitalIntegrationActive,
  testHospitalIntegrationConnection,
} from "@/actions/admin-hospital-integration";

type IntegrationState = {
  apiUrl: string;
  apiTokenMasked: string;
  active: boolean;
  lastCheckedAt: Date | string | null;
  lastCheckOk: boolean | null;
};

export function HospitalIntegrationModal({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [integration, setIntegration] = useState<IntegrationState | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");

  async function loadIntegration() {
    setLoading(true);
    try {
      const data = await getHospitalIntegration(clinicId);
      setIntegration(data);
      if (data) setApiUrl(data.apiUrl);
    } catch {
      toast.error("Erro ao carregar integração hospitalar.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      loadIntegration();
    } else {
      setApiToken("");
    }
  }

  async function handleSave() {
    if (!apiUrl) {
      toast.error("Preencha a URL do bridge.");
      return;
    }
    setSaving(true);
    try {
      await saveHospitalIntegrationConfig(clinicId, { apiUrl, apiToken });
      toast.success("Integração salva! Teste a conexão pra confirmar.");
      setApiToken("");
      await loadIntegration();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar integração.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await testHospitalIntegrationConnection(clinicId);
      if (result.success) {
        toast.success("Conexão OK — o bridge respondeu.");
      } else {
        toast.error("Não foi possível conectar ao bridge. Confira URL/token.");
      }
      await loadIntegration();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao testar conexão.");
    } finally {
      setTesting(false);
    }
  }

  async function handleToggleActive() {
    if (!integration) return;
    setToggling(true);
    try {
      await toggleHospitalIntegrationActive(clinicId, !integration.active);
      toast.success(!integration.active ? "Integração ativada." : "Integração desativada.");
      await loadIntegration();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar integração.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex items-center justify-center w-9 h-9 text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900 border border-cyan-200 dark:border-cyan-800 rounded-xl transition-all cursor-pointer"
        title="Integração Hospitalar"
        aria-label="Integração Hospitalar"
      >
        <Building2 className="w-4 h-4" />
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Sistema hospitalar — {clinicName}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Conecta essa clínica ao próprio sistema de gestão (via bridge) — procedimentos,
            médicos, convênios e agendamentos passam a vir de lá em vez do catálogo do
            marketplace. Sem integração configurada, a clínica usa o catálogo normal.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            {integration && (
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    !integration.active
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      : integration.lastCheckOk
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : integration.lastCheckOk === false
                          ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                          : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                  }`}
                >
                  {!integration.active ? (
                    <Circle className="w-3.5 h-3.5" />
                  ) : integration.lastCheckOk ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {!integration.active
                    ? "Desativada"
                    : integration.lastCheckOk == null
                      ? "Ainda não testada"
                      : integration.lastCheckOk
                        ? "Conectada"
                        : "Falha na conexão"}
                  {integration.lastCheckedAt && (
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      · verificado {new Date(integration.lastCheckedAt).toLocaleTimeString("pt-BR")}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={integration.active}
                  disabled={toggling}
                  onClick={handleToggleActive}
                  className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-50 transition-colors"
                >
                  {integration.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="hosp-api-url" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  URL Base do Bridge
                </label>
                <input
                  id="hosp-api-url"
                  type="text"
                  placeholder="https://api-clinica.exemplo.com.br"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
              <div>
                <label htmlFor="hosp-api-token" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Token
                </label>
                <input
                  id="hosp-api-token"
                  type="password"
                  placeholder={
                    integration
                      ? `Preenchido (${integration.apiTokenMasked}) — deixe em branco para manter`
                      : "Token fornecido pelo bridge"
                  }
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  autoComplete="off"
                  className="w-full mt-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-xl transition-all"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? "Salvando..." : "Salvar Credenciais"}
              </button>
            </div>

            {integration && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTest}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-all"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Testar Conexão
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

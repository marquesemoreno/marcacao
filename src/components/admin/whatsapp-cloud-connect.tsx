"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PlugZap, Send, Smartphone, Unplug } from "lucide-react";
import {
  connectWhatsappCloud,
  disconnectWhatsappCloud,
  sendCloudTestMessage,
  type CloudAccountRow,
} from "@/actions/admin-whatsapp-cloud";
import { META_APP_ID, META_ES_CONFIG_ID, META_GRAPH_VERSION } from "@/lib/meta-config";

/* eslint-disable @typescript-eslint/no-explicit-any -- SDK do Facebook carregado em runtime, sem tipos */
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

/** Carrega o SDK de JavaScript da Meta uma vez. */
function loadFacebookSdk(): Promise<void> {
  if (window.FB) return Promise.resolve();
  return new Promise((resolve) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: META_GRAPH_VERSION });
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);
  });
}

type SignupSession = { wabaId?: string; phoneNumberId?: string; finished?: boolean };

/** Tela /admin/whatsapp (só equipe TIVDC): conecta o número de uma clínica à API oficial do
 * WhatsApp pelo Cadastro incorporado da Meta (Embedded Signup), com opção de coexistência
 * (número que já usa o app WhatsApp Business continua funcionando no celular). */
export function WhatsappCloudConnect({ rows }: { rows: CloudAccountRow[] }) {
  const [clinicId, setClinicId] = useState("");
  const [coexistence, setCoexistence] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [testTo, setTestTo] = useState<Record<string, string>>({});
  const session = useRef<SignupSession>({});

  // A Meta manda waba_id / phone_number_id por postMessage durante o fluxo do popup.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (String(data.event).startsWith("FINISH")) {
          session.current = { wabaId: data.data?.waba_id, phoneNumberId: data.data?.phone_number_id, finished: true };
        } else if (data.event === "CANCEL") {
          session.current = {};
        }
      } catch {
        // mensagens que não são do cadastro
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function handleConnect() {
    if (!clinicId) {
      toast.error("Escolha a clínica antes de conectar.");
      return;
    }
    setConnecting(true);
    session.current = {};
    try {
      await loadFacebookSdk();
      window.FB.login(
        (response: any) => {
          const code = response?.authResponse?.code;
          if (!code) {
            setConnecting(false);
            toast.error("Cadastro cancelado ou não concluído.");
            return;
          }
          // O postMessage com os ids pode chegar logo depois do callback — dá um respiro.
          setTimeout(async () => {
            const { wabaId, phoneNumberId } = session.current;
            const result = await connectWhatsappCloud({
              clinicId,
              code,
              wabaId: wabaId ?? "",
              phoneNumberId: phoneNumberId ?? "",
              coexistence,
            }).catch((e) => ({ success: false as const, error: e instanceof Error ? e.message : "Erro inesperado" }));
            setConnecting(false);
            if (!result.success) {
              toast.error(result.error);
              return;
            }
            toast.success(`Conectado: ${result.displayPhoneNumber ?? "número da clínica"}.`);
            for (const w of result.warnings) toast.warning(w);
          }, 1500);
        },
        {
          config_id: META_ES_CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            sessionInfoVersion: "3",
            ...(coexistence ? { featureType: "whatsapp_business_app_onboarding" } : {}),
          },
        },
      );
    } catch {
      setConnecting(false);
      toast.error("Não foi possível abrir o cadastro da Meta. Recarregue a página e tente de novo.");
    }
  }

  async function handleTest(row: CloudAccountRow) {
    const to = testTo[row.clinicId] ?? "";
    const r = await sendCloudTestMessage(row.clinicId, to);
    if (r.success) toast.success("Mensagem de teste (hello_world) enviada.");
    else toast.error(r.error ?? "Falha ao enviar.");
  }

  async function handleDisconnect(row: CloudAccountRow) {
    if (!confirm(`Remover a conexão da API oficial de ${row.clinicName}? A clínica continua na Evolution.`)) return;
    await disconnectWhatsappCloud(row.clinicId);
    toast.success("Conexão removida.");
  }

  const connected = rows.filter((r) => r.account);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">WhatsApp — API oficial</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Conecta o número de uma clínica à API oficial da Meta. A conexão fica <strong>desligada</strong> para o Chat até
          ser testada — a clínica continua usando a Evolution normalmente.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Conectar um número</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-700 dark:text-slate-300">
            Clínica
            <select
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm"
            >
              <option value="">Escolha a clínica</option>
              {rows.map((r) => (
                <option key={r.clinicId} value={r.clinicId}>
                  {r.clinicName}
                  {r.account ? " (já conectada — reconectar)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 sm:pt-6">
            <input type="checkbox" checked={coexistence} onChange={(e) => setCoexistence(e.target.checked)} className="mt-0.5 size-4 accent-emerald-600" />
            <span>
              <span className="font-medium">O número já usa o app WhatsApp Business</span> (coexistência — continua funcionando
              no celular e no WhatsApp Web)
            </span>
          </label>
        </div>
        {coexistence && (
          <p className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
            Durante o cadastro, a Meta pede para abrir o app WhatsApp Business no celular da clínica e confirmar. Os aparelhos
            vinculados serão desconectados e precisam ser vinculados de novo (WhatsApp Web funciona; WhatsApp para Windows não).
            O histórico dos últimos 6 meses é sincronizado automaticamente após conectar.
          </p>
        )}
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white"
        >
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
          {connecting ? "Conectando…" : "Conectar WhatsApp"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Números conectados</h2>
        {connected.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Nenhuma clínica conectada à API oficial ainda.</p>
        ) : (
          connected.map((row) => (
            <div key={row.clinicId} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{row.clinicName}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" aria-hidden />
                    {row.account!.displayPhoneNumber ?? row.account!.phoneNumberId}
                    {row.account!.coexistence && " · coexistência"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                    row.account!.active
                      ? "border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-300"
                      : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
                  }`}
                >
                  {row.account!.active ? <CheckCircle2 className="w-3 h-3" aria-hidden /> : null}
                  {row.account!.active ? "Ativa no Chat" : "Conectada (desligada no Chat)"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={testTo[row.clinicId] ?? ""}
                  onChange={(e) => setTestTo((p) => ({ ...p, [row.clinicId]: e.target.value }))}
                  placeholder="5577999998888"
                  aria-label="Número para mensagem de teste"
                  className="h-8 w-44 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleTest(row)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden /> Enviar teste (hello_world)
                </button>
                <button
                  type="button"
                  onClick={() => handleDisconnect(row)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Unplug className="w-3.5 h-3.5" aria-hidden /> Remover conexão
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

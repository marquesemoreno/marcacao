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
import { t, type Lang } from "@/lib/i18n-review";
import { CloudTabs } from "@/components/admin/cloud-tabs";

/* eslint-disable @typescript-eslint/no-explicit-any -- SDK do Facebook carregado em runtime, sem tipos */
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

/** Carrega o SDK de JavaScript da Meta uma vez. */
function loadFacebookSdk(locale: string): Promise<void> {
  if (window.FB) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: META_GRAPH_VERSION });
      resolve();
    };
    const script = document.createElement("script");
    script.src = `https://connect.facebook.net/${locale}/sdk.js`;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => reject(new Error("sdk"));
    document.body.appendChild(script);
  });
}

type SignupSession = { wabaId?: string; phoneNumberId?: string; finished?: boolean; cancelledAt?: string; error?: string };

/** Tela /admin/whatsapp (só equipe TIVDC): conecta o número de uma clínica à API oficial
 * pelo Cadastro incorporado da Meta (Embedded Signup) — número novo (registro) ou
 * coexistência (o número continua no app WhatsApp Business). Textos pt/en (?lang=en). */
export function WhatsappCloudConnect({ rows, lang }: { rows: CloudAccountRow[]; lang: Lang }) {
  const [clinicId, setClinicId] = useState("");
  const [coexistence, setCoexistence] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testTo, setTestTo] = useState<Record<string, string>>({});
  const session = useRef<SignupSession>({});
  const tt = (k: Parameters<typeof t>[1]) => t(lang, k);

  // A Meta manda waba_id / phone_number_id (ou cancelamento/erro) por postMessage.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (String(data.event).startsWith("FINISH")) {
          session.current = { wabaId: data.data?.waba_id, phoneNumberId: data.data?.phone_number_id, finished: true };
        } else if (data.event === "CANCEL") {
          session.current = { cancelledAt: data.data?.current_step };
        } else if (data.event === "ERROR") {
          session.current = { error: data.data?.error_message };
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
      toast.error(tt("connect.chooseFirst"));
      return;
    }
    setConnecting(true);
    session.current = {};
    try {
      await loadFacebookSdk(lang === "en" ? "en_US" : "pt_BR");
      window.FB.login(
        (response: any) => {
          const code = response?.authResponse?.code;
          if (!code) {
            setConnecting(false);
            const s = session.current;
            toast.error(
              s.error
                ? `${tt("connect.cancelled")} (${s.error})`
                : s.cancelledAt
                  ? `${tt("connect.cancelled")} — ${s.cancelledAt}`
                  : tt("connect.cancelled")
            );
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
            toast.success(`${tt("connect.connected")}: ${result.displayPhoneNumber ?? phoneNumberId}`);
            for (const w of result.warnings) toast.warning(w, { duration: 12000 });
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
        }
      );
    } catch {
      setConnecting(false);
      toast.error(tt("connect.sdkError"));
    }
  }

  async function handleTest(row: CloudAccountRow) {
    const to = testTo[row.clinicId] ?? "";
    const r = await sendCloudTestMessage(row.clinicId, to);
    if (r.success) toast.success("hello_world ✓");
    else toast.error(r.error ?? tt("common.error"));
  }

  async function handleDisconnect(row: CloudAccountRow) {
    if (!confirm(`${tt("connect.removeConfirm")} (${row.clinicName})`)) return;
    await disconnectWhatsappCloud(row.clinicId);
    toast.success("OK");
  }

  const connected = rows.filter((r) => r.account);
  const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl">
      <CloudTabs lang={lang} active="/admin/whatsapp" />
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{tt("connect.title")}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{tt("connect.subtitle")}</p>
      </div>

      <section className={`${panel} p-5 space-y-4`}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{tt("connect.section")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-700 dark:text-slate-300">
            {tt("connect.clinic")}
            <select
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm"
            >
              <option value="">{tt("connect.chooseClinic")}</option>
              {rows.map((r) => (
                <option key={r.clinicId} value={r.clinicId}>
                  {r.clinicName}
                  {r.account ? ` (${tt("connect.reconnect")})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 sm:pt-6">
            <input type="checkbox" checked={coexistence} onChange={(e) => setCoexistence(e.target.checked)} className="mt-0.5 size-4 accent-emerald-600" />
            <span>{tt("connect.coexistence")}</span>
          </label>
        </div>
        <p className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-700 dark:text-slate-300">
          {coexistence ? tt("connect.coexistenceNote") : tt("connect.newNumberNote")}
        </p>
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          title={tt("connect.buttonTip")}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white"
        >
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <PlugZap className="w-4 h-4" aria-hidden />}
          {connecting ? tt("connect.connecting") : tt("connect.button")}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">{tt("connect.buttonTip")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{tt("connect.list")}</h2>
        {connected.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{tt("connect.none")}</p>
        ) : (
          connected.map((row) => (
            <div key={row.clinicId} className={`${panel} p-4 space-y-3`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{row.clinicName}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" aria-hidden />
                    {row.account!.displayPhoneNumber ?? row.account!.phoneNumberId}
                    {row.account!.verifiedName && <span className="text-slate-500">· {row.account!.verifiedName}</span>}
                    {row.account!.coexistence && <span className="text-slate-500">· coexistence</span>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {tt("connect.waba")}: {row.account!.wabaId} · {tt("connect.phoneId")}: {row.account!.phoneNumberId}
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
                  {row.account!.active ? tt("connect.activeInbox") : tt("connect.offInbox")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={testTo[row.clinicId] ?? ""}
                  onChange={(e) => setTestTo((p) => ({ ...p, [row.clinicId]: e.target.value }))}
                  placeholder="5577999998888"
                  aria-label={tt("send.to")}
                  className="h-8 w-44 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleTest(row)}
                  title={tt("connect.testTip")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden /> {tt("connect.test")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDisconnect(row)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Unplug className="w-3.5 h-3.5" aria-hidden /> {tt("connect.remove")}
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

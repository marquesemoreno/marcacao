"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2, PlugZap, Send, Smartphone, Unplug, X } from "lucide-react";
import {
  connectWhatsappCloud,
  disconnectWhatsappCloud,
  sendCloudTestMessage,
  type CloudAccountRow,
} from "@/actions/admin-whatsapp-cloud";
import { META_APP_ID, META_ES_CONFIG_ID, META_GRAPH_VERSION } from "@/lib/meta-config";
import { t, type Lang } from "@/lib/i18n-review";
import { CloudTabs } from "@/components/admin/cloud-tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

/** postMessage do cadastro só vale vindo de facebook.com ou de um subdomínio dele
 * (endsWith("facebook.com") sozinho aceitaria "evilfacebook.com"). */
function isFacebookOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

type SignupSession = { wabaId?: string; phoneNumberId?: string; finished?: boolean; cancelledAt?: string; error?: string };

/** Espera o postMessage FINISH com os ids (pode chegar depois do callback do login) —
 * até 10 s, em vez de um único respiro fixo de 1,5 s que às vezes perdia os ids. */
async function waitForSignupIds(session: { current: SignupSession }, timeoutMs = 10_000): Promise<SignupSession> {
  const start = Date.now();
  while (!session.current.finished && !session.current.error && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 250));
  }
  return session.current;
}

const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";

/** Tela /admin/whatsapp (só equipe TIVDC): conecta o número de uma clínica à API oficial
 * pelo Cadastro incorporado da Meta (Embedded Signup) — número novo (registro) ou
 * coexistência (o número continua no app WhatsApp Business). Textos pt/en (?lang=en).
 * Depois de conectar, a conta e o número ficam em destaque (a análise da Meta precisa
 * ver o ativo selecionado no vídeo). */
export function WhatsappCloudConnect({ rows, lang }: { rows: CloudAccountRow[]; lang: Lang }) {
  const [clinicId, setClinicId] = useState("");
  const [coexistence, setCoexistence] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [justConnected, setJustConnected] = useState<string | null>(null);
  const [testTo, setTestTo] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CloudAccountRow | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const session = useRef<SignupSession>({});
  const tt = (k: Parameters<typeof t>[1], vars?: Record<string, string>) => t(lang, k, vars);

  // A Meta manda waba_id / phone_number_id (ou cancelamento/erro) por postMessage.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isFacebookOrigin(event.origin)) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (String(data.event).startsWith("FINISH")) {
          // FINISH_ONLY_WABA: conta criada sem número — phoneNumberId fica vazio e o
          // servidor responde com a mensagem própria (err.onlyWaba).
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

  // Card recém-conectado: rola até ele (o revisor da Meta precisa ver o ativo).
  useEffect(() => {
    if (!justConnected) return;
    document.getElementById(`cloud-account-${justConnected}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [justConnected, rows]);

  async function handleConnect() {
    if (!clinicId) {
      toast.error(tt("connect.chooseFirst"));
      return;
    }
    setConnecting(true);
    setFinishing(false);
    setJustConnected(null);
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
                  ? `${tt("connect.cancelled")} — ${stepText(s.cancelledAt)}`
                  : tt("connect.cancelled")
            );
            return;
          }
          void (async () => {
            setFinishing(true);
            const { wabaId, phoneNumberId } = await waitForSignupIds(session);
            const result = await connectWhatsappCloud({
              clinicId,
              code,
              wabaId: wabaId ?? "",
              phoneNumberId: phoneNumberId ?? "",
              coexistence,
              lang,
            }).catch(() => ({ success: false as const, error: tt("err.unexpected") }));
            setConnecting(false);
            setFinishing(false);
            if (!result.success) {
              toast.error(result.error);
              return;
            }
            toast.success(`${tt("connect.connected")}: ${result.displayPhoneNumber ?? phoneNumberId}`);
            for (const w of result.warnings) toast.warning(w, { duration: 12000 });
            setJustConnected(clinicId);
          })();
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
    const to = (testTo[row.clinicId] ?? "").replace(/\D/g, "");
    setTesting(row.clinicId);
    try {
      const r = await sendCloudTestMessage(row.clinicId, to, lang);
      if (r.success) toast.success(tt("connect.testSent", { to: `+${to}` }));
      else toast.error(r.error ?? tt("common.error"));
    } catch {
      toast.error(tt("err.unexpected"));
    } finally {
      setTesting(null);
    }
  }

  async function confirmDisconnect() {
    if (!removing) return;
    setRemovePending(true);
    try {
      const r = await disconnectWhatsappCloud(removing.clinicId);
      if (!r.success) throw new Error("disconnect");
      toast.success(tt("connect.removed", { clinic: removing.clinicName }));
      if (justConnected === removing.clinicId) setJustConnected(null);
      setRemoving(null);
    } catch {
      toast.error(tt("err.unexpected"));
    } finally {
      setRemovePending(false);
    }
  }

  /** Passo cru da Meta (ex.: PHONE_NUMBER_SETUP) → frase legível. */
  function stepText(step: string) {
    try {
      return tt(`connect.step.${step}` as Parameters<typeof t>[1]);
    } catch {
      return tt("connect.step.other");
    }
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value).then(() => toast.success(tt("connect.copied")), () => {});
  }

  const connected = rows.filter((r) => r.account);
  const removingPhone = removing?.account?.displayPhoneNumber ?? removing?.account?.phoneNumberId ?? "";

  return (
    <div lang={lang === "en" ? "en" : "pt-BR"} className="flex-1 min-h-0 overflow-y-auto"><div className="space-y-6 p-4 sm:p-6 max-w-4xl">
      <CloudTabs lang={lang} active="/admin/whatsapp" />
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{tt("connect.title")}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{tt("connect.subtitle")}</p>
      </div>

      <section className={`${panel} p-5 space-y-4`} aria-busy={connecting}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{tt("connect.section")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-700 dark:text-slate-300">
            {tt("connect.clinic")}
            <select
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              disabled={connecting}
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
        </div>
        {!clinicId && <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">{tt("connect.clinicHint")}</p>}
        {/* Número novo × coexistência: escolha que muda o fluxo inteiro da Meta (SMS × QR). */}
        <fieldset className="space-y-2 disabled:opacity-60" disabled={connecting}>
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">{tt("connect.numberType")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { value: false, label: tt("connect.typeNew"), hint: tt("connect.typeNewHint"), note: tt("connect.newNumberNote") },
              { value: true, label: tt("connect.typeCoex"), hint: tt("connect.typeCoexHint"), note: tt("connect.coexistenceNote") },
            ].map((o) => {
              const selected = coexistence === o.value;
              return (
                <label
                  key={String(o.value)}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                    selected ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500" : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="number-type"
                    checked={selected}
                    onChange={() => setCoexistence(o.value)}
                    className="mt-0.5 size-4 accent-emerald-600"
                  />
                  <span className="space-y-1">
                    <span className="block font-semibold text-slate-900 dark:text-slate-100">{o.label}</span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{o.hint}</span>
                    {selected && (
                      <span className={`block text-xs ${o.value ? "font-semibold text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>
                        {o.note}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting || !clinicId}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white"
        >
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <PlugZap className="w-4 h-4" aria-hidden />}
          {finishing ? tt("connect.finishing") : connecting ? tt("connect.connecting") : tt("connect.button")}
        </button>
        <p className="sr-only" aria-live="polite">
          {finishing ? tt("connect.finishing") : connecting ? tt("connect.connecting") : ""}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{tt("connect.buttonTip")}</p>
      </section>

      {justConnected && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{tt("connect.successBanner")}</p>
            <Link href={`/admin/whatsapp/enviar?lang=${lang}`} className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 underline underline-offset-2">
              {tt("connect.nextSend")}
            </Link>
          </div>
          <button type="button" onClick={() => setJustConnected(null)} aria-label={tt("connect.dismiss")} className="rounded p-1 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{tt("connect.list")}</h2>
        {connected.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{tt("connect.none")}</p>
        ) : (
          connected.map((row) => {
            const a = row.account!;
            const isNew = justConnected === row.clinicId;
            const fields: [string, string | null][] = [
              [tt("connect.verifiedName"), a.verifiedName],
              [tt("connect.phone"), a.displayPhoneNumber],
              [tt("connect.waba"), a.wabaId],
              [tt("connect.phoneId"), a.phoneNumberId],
            ];
            return (
              <div
                key={row.clinicId}
                id={`cloud-account-${row.clinicId}`}
                className={`${panel} p-4 space-y-4 ${isNew ? "ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-slate-500" aria-hidden />
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{row.clinicName}</p>
                    {isNew && (
                      <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white">{tt("connect.justConnected")}</span>
                    )}
                    {a.coexistence && <span className="text-xs text-slate-500">· {tt("connect.coexBadge")}</span>}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                      a.active
                        ? "border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-300"
                        : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {a.active ? <CheckCircle2 className="w-3 h-3" aria-hidden /> : null}
                    {a.active ? tt("connect.activeInbox") : tt("connect.offInbox")}
                  </span>
                </div>

                {/* Ativo selecionado, legível no vídeo: rótulo + valor + copiar. */}
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {fields.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
                      <dd className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{value ?? "—"}</span>
                        {value && (
                          <button
                            type="button"
                            onClick={() => copy(value)}
                            aria-label={`${tt("connect.copy")} ${label}`}
                            title={tt("connect.copy")}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {tt("connect.testLabel")}
                    <input
                      value={testTo[row.clinicId] ?? ""}
                      onChange={(e) => setTestTo((p) => ({ ...p, [row.clinicId]: e.target.value }))}
                      placeholder="5577999998888"
                      inputMode="tel"
                      aria-describedby={`test-hint-${row.clinicId}`}
                      aria-invalid={(() => {
                        const n = (testTo[row.clinicId] ?? "").replace(/\D/g, "").length;
                        return n > 0 && n < 12;
                      })()}
                      className="mt-1 block h-8 w-48 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleTest(row)}
                    disabled={testing === row.clinicId || (testTo[row.clinicId] ?? "").replace(/\D/g, "").length < 12}
                    title={tt("connect.testTip")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {testing === row.clinicId ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Send className="w-3.5 h-3.5" aria-hidden />}
                    {tt("connect.test")}
                  </button>
                  {(() => {
                    const n = (testTo[row.clinicId] ?? "").replace(/\D/g, "").length;
                    return (
                      <p id={`test-hint-${row.clinicId}`} aria-live="polite" className="basis-full text-xs text-amber-800 dark:text-amber-300">
                        {n > 0 && n < 12 ? tt("err.badNumber") : ""}
                      </p>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => setRemoving(row)}
                    className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Unplug className="w-3.5 h-3.5" aria-hidden /> {tt("connect.remove")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && !removePending && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tt("connect.removeTitle", { clinic: removing?.clinicName ?? "" })}</DialogTitle>
            <DialogDescription>{tt("connect.removeBody", { phone: removingPhone })}</DialogDescription>
          </DialogHeader>
          {removing?.account?.coexistence && <p className="text-sm text-slate-700 dark:text-slate-300">{tt("connect.removeCoex")}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRemoving(null)}
              disabled={removePending}
              className="h-9 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              {tt("connect.removeCancel")}
            </button>
            <button
              type="button"
              onClick={confirmDisconnect}
              disabled={removePending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-4 text-sm font-semibold text-white"
            >
              {removePending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {tt("connect.removeConfirmButton", { phone: removingPhone })}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCheck, Check, Clock, Loader2, Send, XCircle } from "lucide-react";
import { listCloudTestMessages, sendCloudTestText, type CloudAssets } from "@/actions/admin-whatsapp-cloud";
import { t, type I18nKey, type Lang } from "@/lib/i18n-review";
import { CloudTabs } from "@/components/admin/cloud-tabs";

type Row = Awaited<ReturnType<typeof listCloudTestMessages>>[number];

const STATUS_ICON: Record<string, React.ReactNode> = {
  SENDING: <Clock className="w-3.5 h-3.5" aria-hidden />,
  SENT: <Check className="w-3.5 h-3.5" aria-hidden />,
  DELIVERED: <CheckCheck className="w-3.5 h-3.5" aria-hidden />,
  READ: <CheckCheck className="w-3.5 h-3.5 text-sky-500" aria-hidden />,
  FAILED: <XCircle className="w-3.5 h-3.5 text-rose-600" aria-hidden />,
};

/** Tela /admin/whatsapp/enviar — envio pela Cloud API com a conta (WABA) e o número
 * visíveis e o status ao vivo (webhook). Feita pra gravação da análise do app pela Meta
 * (whatsapp_business_messaging): escolher o ativo, enviar, ver chegar no celular. */
export function CloudSendMessage({ assets, lang }: { assets: CloudAssets[]; lang: Lang }) {
  const tt = (k: I18nKey) => t(lang, k);
  const [clinicId, setClinicId] = useState(assets[0]?.clinicId ?? "");
  const asset = useMemo(() => assets.find((a) => a.clinicId === clinicId), [assets, clinicId]);
  const [phoneNumberId, setPhoneNumberId] = useState(assets[0]?.defaultPhoneNumberId ?? "");
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const refresh = useCallback(() => {
    if (clinicId) listCloudTestMessages(clinicId).then(setRows).catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function send() {
    if (!asset) return;
    setSending(true);
    try {
      const r = await sendCloudTestText({ clinicId, phoneNumberId, to, text });
      if (r.success) {
        toast.success(tt("send.sent"));
        setText("");
        refresh();
      } else toast.error(r.error);
    } finally {
      setSending(false);
    }
  }

  const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
  const input = "mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto"><div className="space-y-6 p-4 sm:p-6 max-w-4xl">
      <CloudTabs lang={lang} active="/admin/whatsapp/enviar" />
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{tt("send.title")}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{tt("send.subtitle")}</p>
      </div>

      {assets.length === 0 ? (
        <p className={`${panel} p-5 text-sm text-slate-600 dark:text-slate-400`}>{tt("send.noAccount")}</p>
      ) : (
        <section className={`${panel} p-5 space-y-4`}>
          <div title={tt("send.assetTip")}>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tt("send.asset")}</p>
            <div className="mt-1 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {tt("connect.clinic")} / {tt("connect.waba")}
                <select
                  value={clinicId}
                  onChange={(e) => {
                    setClinicId(e.target.value);
                    const a = assets.find((x) => x.clinicId === e.target.value);
                    setPhoneNumberId(a?.defaultPhoneNumberId ?? "");
                  }}
                  className={input}
                >
                  {assets.map((a) => (
                    <option key={a.clinicId} value={a.clinicId}>
                      {a.clinicName} — WABA {a.wabaId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {tt("connect.phoneId")}
                <select value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} className={input}>
                  {asset?.phoneNumbers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_phone_number}
                      {p.verified_name ? ` — ${p.verified_name}` : ""} ({p.id})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {asset?.error && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{asset.error}</p>}
          </div>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            {tt("send.to")}
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="5577999998888" inputMode="tel" className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            {tt("send.text")}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">{tt("send.textHint")}</p>
          <button
            type="button"
            disabled={sending || !to.trim() || !text.trim()}
            onClick={send}
            title={tt("send.buttonTip")}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 text-sm font-semibold text-white"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
            {tt("send.button")}
          </button>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100" title={tt("send.historyTip")}>
          {tt("send.history")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{tt("send.historyTip")}</p>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{tt("send.empty")}</p>
        ) : (
          <ul className={`${panel} divide-y divide-slate-100 dark:divide-slate-800`} aria-live="polite">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-2.5 text-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">{r.body}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    → {r.to}
                    {r.templateName ? ` · template ${r.templateName}` : ""} · {new Date(r.createdAt).toLocaleTimeString(lang === "en" ? "en-US" : "pt-BR")}
                  </p>
                  {r.error && <p className="text-xs text-rose-700 dark:text-rose-400">{r.error}</p>}
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {STATUS_ICON[r.status] ?? null}
                  {tt(`status.${r.status}` as I18nKey)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
    </div>
  );
}

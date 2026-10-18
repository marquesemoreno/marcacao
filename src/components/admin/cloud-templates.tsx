"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import {
  createClinicCloudTemplate,
  listClinicCloudTemplates,
  listCloudTestMessages,
  sendCloudTestTemplate,
  type CloudAssets,
  type TemplateRow,
} from "@/actions/admin-whatsapp-cloud";
import { t, type I18nKey, type Lang } from "@/lib/i18n-review";
import { CloudTabs } from "@/components/admin/cloud-tabs";

const STATUS_CLASS: Record<string, string> = {
  APPROVED: "border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-300",
  PENDING: "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300",
  REJECTED: "border-rose-300 text-rose-800 dark:border-rose-700 dark:text-rose-300",
};

type TestRow = Awaited<ReturnType<typeof listCloudTestMessages>>[number];

/** Tela /admin/whatsapp/templates — modelos da WABA da clínica (whatsapp_business_management):
 * listar com status, criar (vai pra análise da Meta), atualizar status, abrir no WhatsApp
 * Manager e enviar um modelo aprovado preenchendo as variáveis. */
export function CloudTemplates({ assets, lang }: { assets: CloudAssets[]; lang: Lang }) {
  const tt = (k: I18nKey) => t(lang, k);
  const [clinicId, setClinicId] = useState(assets[0]?.clinicId ?? "");
  const asset = useMemo(() => assets.find((a) => a.clinicId === clinicId), [assets, clinicId]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("appointment_reminder");
  const [category, setCategory] = useState<"UTILITY" | "MARKETING">("UTILITY");
  const [language, setLanguage] = useState("en_US");
  const [body, setBody] = useState("Hello {{1}}, this is a reminder of your appointment on {{2}}. Reply here if you need to reschedule.");
  const [examples, setExamples] = useState<string[]>(["Maria", "Oct 20 at 2:00 PM"]);
  const [creating, setCreating] = useState(false);

  const [sendFor, setSendFor] = useState<TemplateRow | null>(null);
  const [to, setTo] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<TestRow[]>([]);

  const varCount = new Set(body.match(/\{\{\d+\}\}/g) ?? []).size;

  const refresh = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    const r = await listClinicCloudTemplates(clinicId).catch((e) => ({ success: false as const, error: String(e) }));
    if (r.success) setTemplates(r.templates);
    else setError(r.error);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!clinicId) return;
    const load = () => listCloudTestMessages(clinicId).then((rows) => setSent(rows.filter((r) => r.kind === "TEMPLATE"))).catch(() => {});
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [clinicId]);

  async function create() {
    setCreating(true);
    try {
      const r = await createClinicCloudTemplate({ clinicId, name, category, language, body, examples });
      if (r.success) {
        toast.success(`${tt("tpl.created")} (${r.name} · ${r.status})`);
        refresh();
      } else toast.error(r.error);
    } finally {
      setCreating(false);
    }
  }

  async function sendTemplate() {
    if (!sendFor || !asset) return;
    setSending(true);
    try {
      const r = await sendCloudTestTemplate({
        clinicId,
        phoneNumberId: asset.defaultPhoneNumberId,
        to,
        name: sendFor.name,
        language: sendFor.language,
        bodyText: sendFor.bodyText,
        params: params.slice(0, sendFor.variableCount),
      });
      if (r.success) toast.success(tt("send.sent"));
      else toast.error(r.error);
    } finally {
      setSending(false);
    }
  }

  const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
  const input = "mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500";
  const managerUrl = asset ? `https://business.facebook.com/wa/manage/message-templates/?waba_id=${asset.wabaId}` : "#";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto"><div className="space-y-6 p-4 sm:p-6 max-w-5xl">
      <CloudTabs lang={lang} active="/admin/whatsapp/templates" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{tt("tpl.title")}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{tt("tpl.subtitle")}</p>
        </div>
        {assets.length > 0 && (
          <select value={clinicId} onChange={(e) => setClinicId(e.target.value)} aria-label={tt("connect.waba")} className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm">
            {assets.map((a) => (
              <option key={a.clinicId} value={a.clinicId}>
                {a.clinicName} — WABA {a.wabaId}
              </option>
            ))}
          </select>
        )}
      </div>

      {assets.length === 0 ? (
        <p className={`${panel} p-5 text-sm text-slate-600 dark:text-slate-400`}>{tt("send.noAccount")}</p>
      ) : (
        <>
          <section className={`${panel} p-4 space-y-3`}>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={refresh} disabled={loading} title={tt("tpl.refreshTip")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RefreshCw className="w-4 h-4" aria-hidden />} {tt("tpl.refresh")}
              </button>
              <a href={managerUrl} target="_blank" rel="noreferrer" title={tt("tpl.managerTip")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800">
                <ExternalLink className="w-4 h-4" aria-hidden /> {tt("tpl.manager")}
              </a>
            </div>
            {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2 pr-3">{tt("tpl.name")}</th>
                    <th className="py-2 pr-3">{tt("tpl.category")}</th>
                    <th className="py-2 pr-3">{tt("tpl.language")}</th>
                    <th className="py-2 pr-3">{tt("tpl.status")}</th>
                    <th className="py-2 pr-3">{tt("tpl.body")}</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-slate-500">{loading ? tt("common.loading") : tt("tpl.empty")}</td>
                    </tr>
                  ) : (
                    templates.map((tp) => (
                      <tr key={tp.id} className="border-b border-slate-100 dark:border-slate-800 align-top">
                        <td className="py-2 pr-3 font-mono text-xs">{tp.name}</td>
                        <td className="py-2 pr-3">{tp.category}</td>
                        <td className="py-2 pr-3">{tp.language}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[tp.status] ?? "border-slate-300 text-slate-700"}`}>{tp.status}</span>
                        </td>
                        <td className="py-2 pr-3 max-w-xs text-slate-600 dark:text-slate-300">{tp.bodyText}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            disabled={tp.status !== "APPROVED"}
                            title={tp.status === "APPROVED" ? tt("tpl.sendTip") : tt("tpl.sendOnlyApproved")}
                            onClick={() => {
                              setSendFor(tp);
                              setParams(Array.from({ length: tp.variableCount }, () => ""));
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 px-2.5 text-xs font-semibold text-white"
                          >
                            <Send className="w-3.5 h-3.5" aria-hidden /> {tt("tpl.send")}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {sendFor && (
            <section className={`${panel} p-4 space-y-3`} aria-label={tt("tpl.send")}>
              <h2 className="text-base font-semibold">
                {tt("tpl.send")}: <span className="font-mono text-sm">{sendFor.name}</span> ({sendFor.language})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("send.asset")}: WABA {asset?.wabaId} · {asset?.phoneNumbers.find((p) => p.id === asset.defaultPhoneNumberId)?.display_phone_number}
              </p>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {tt("send.to")}
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="5577999998888" className={input} />
              </label>
              {params.map((p, i) => (
                <label key={i} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {tt("tpl.variable")} {`{{${i + 1}}}`}
                  <input value={p} onChange={(e) => setParams((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} className={input} />
                </label>
              ))}
              <p className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-2 text-sm whitespace-pre-wrap text-slate-900 dark:text-slate-100">
                {sendFor.bodyText.replace(/\{\{(\d+)\}\}/g, (_, n: string) => params[Number(n) - 1] || `{{${n}}}`)}
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={sending || !to.trim() || params.some((p) => !p.trim())} onClick={sendTemplate} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 text-sm font-semibold text-white">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />} {tt("send.button")}
                </button>
                <button type="button" onClick={() => setSendFor(null)} className="h-9 px-3 text-sm text-slate-600 dark:text-slate-300">
                  ✕
                </button>
              </div>
              {sent.length > 0 && (
                <ul className="text-xs space-y-1" aria-live="polite">
                  {sent.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-1">
                      <span className="truncate">
                        {r.templateName} → {r.to}
                      </span>
                      <span className="font-semibold">{tt(`status.${r.status}` as I18nKey)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className={`${panel} p-4 space-y-3`} aria-label={tt("tpl.create")}>
            <h2 className="text-base font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" aria-hidden /> {tt("tpl.create")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {tt("tpl.name")}
                <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {tt("tpl.category")}
                <select value={category} onChange={(e) => setCategory(e.target.value as "UTILITY" | "MARKETING")} className={input}>
                  <option value="UTILITY">UTILITY</option>
                  <option value="MARKETING">MARKETING</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {tt("tpl.language")}
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={input}>
                  <option value="en_US">en_US</option>
                  <option value="pt_BR">pt_BR</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              {tt("tpl.body")}
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm" />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">{tt("tpl.bodyHint")}</p>
            {Array.from({ length: varCount }, (_, i) => (
              <label key={i} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {tt("tpl.example")} {`{{${i + 1}}}`}
                <input value={examples[i] ?? ""} onChange={(e) => setExamples((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })} className={input} />
              </label>
            ))}
            <button type="button" disabled={creating || !name.trim() || !body.trim()} onClick={create} title={tt("tpl.createTip")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 text-sm font-semibold text-white">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />} {tt("tpl.create")}
            </button>
          </section>
        </>
      )}
    </div>
    </div>
  );
}

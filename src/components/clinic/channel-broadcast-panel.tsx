"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClinicChannelCampaign, getChannelSetup, registerChannelConsents } from "@/actions/clinic-channel-broadcast";
import { smsCredits } from "@/lib/broadcast-channel";
import { applyBroadcastVariables } from "@/lib/broadcast-csv";
import { parseConsentList } from "@/lib/channel-consent";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BroadcastPreview } from "@/components/clinic/broadcast-preview";

const inputClass =
  "w-full mt-1 h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500";
const textareaClass = `${inputClass} h-auto py-2 resize-y`;
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-400";
const primaryBtn =
  "inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg";

export type ChannelSetup = Awaited<ReturnType<typeof getChannelSetup>>;
type Channel = "SMS" | "EMAIL";

const CSV_HINT: Record<Channel, string> = {
  SMS: "telefone,nome,procedimento\n77999991234,Maria,retorno",
  EMAIL: "email,nome,procedimento\nmaria@exemplo.com,Maria,retorno",
};

/** Rodapé que todo SMS/e-mail leva (RT do CFM + link para sair) — só para a prévia e a conta
 * de créditos; o texto real é montado no envio (src/lib/channel-broadcast.ts). */
const FOOTER_SAMPLE = `\nRT: Dr. Nome Sobrenome — CRM-BA 12345\nSair: https://conectasaudevc.com.br/api/u/${"x".repeat(42)}`;

/** Campos de "Nova campanha" quando o canal é SMS ou e-mail (o WhatsApp fica em
 * broadcast-management.tsx). Público por lista com telefone/e-mail; só recebe quem tem aceite
 * daquele canal (LGPD). Cria rascunho — o início passa pela confirmação da lista. */
export function ChannelCampaignFields({ channel, onCreated }: { channel: Channel; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [template, setTemplate] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);

  const sampleVars = { nome: "Maria", procedimento: "consulta", data: "10/11" };
  const sample = template.trim() ? applyBroadcastVariables(template, sampleVars) : "";
  const credits = smsCredits(`${sample}${FOOTER_SAMPLE}`);
  const missing = !name.trim() ? "Falta dar um nome à campanha." : !template.trim() ? "Falta escrever a mensagem." : channel === "EMAIL" && !subject.trim() ? "Falta o assunto do e-mail." : !csv.trim() ? "Falta a lista de destinatários." : null;

  async function submit() {
    setBusy(true);
    try {
      const result = await createClinicChannelCampaign({ channel, name, subject, messageTemplate: template, extraVariants: variants, csv });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const dropped = [result.invalid ? `${result.invalid} inválido(s)` : "", result.duplicates ? `${result.duplicates} repetido(s)` : ""].filter(Boolean).join(", ");
      toast.success(
        `Rascunho criado com ${result.total} destinatário(s)${dropped ? ` (descartados: ${dropped})` : ""}. ${result.withConsent} têm aceite deste canal. Confira e clique em Iniciar.`
      );
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a campanha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="block">
        <span className={labelClass}>
          Nome da campanha (só a equipe vê) <span className="text-red-600" aria-hidden>*</span>
        </span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required aria-required="true" placeholder="Ex.: Retorno anual — novembro" />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">1. Para quem</legend>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="channel-csv" className={labelClass}>
            Lista com a coluna {channel === "EMAIL" ? "email" : "telefone"} — as outras colunas viram variáveis (pode colar de uma planilha)
          </label>
          <label className="relative inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500/50 rounded-md px-1">
            <Upload className="w-3.5 h-3.5" aria-hidden /> Enviar arquivo
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setCsv(String(reader.result ?? ""));
                reader.readAsText(file, "utf-8");
              }}
            />
          </label>
        </div>
        <textarea id="channel-csv" className={`${textareaClass} font-mono`} rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={CSV_HINT[channel]} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Só recebe quem tem aceite de {channel === "EMAIL" ? "e-mail" : "SMS"} registrado pela gestão — o aceite do WhatsApp não vale aqui. Os demais ficam como “Sem
          consentimento”.
        </p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">2. Mensagem</legend>
        {channel === "EMAIL" && (
          <label className="block">
            <span className={labelClass}>
              Assunto <span className="text-red-600" aria-hidden>*</span>
            </span>
            <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} required aria-required="true" placeholder="Ex.: {{nome}}, está na hora do seu retorno" />
          </label>
        )}
        <label className="block">
          <span className="sr-only">Texto da mensagem</span>
          <textarea
            className={textareaClass}
            rows={channel === "SMS" ? 4 : 7}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            required
            aria-required="true"
            placeholder="Ex.: Olá {{nome}}, temos horários para {{procedimento}} esta semana."
          />
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">Use {"{{nome}}"}, {"{{procedimento}}"} ou qualquer coluna da lista entre chaves.</p>
        {channel === "SMS" && template.trim() && (
          <p className={`text-xs ${credits > 1 ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
            Com o responsável técnico e o link para sair, cada SMS deve consumir cerca de {credits} {credits === 1 ? "crédito" : "créditos"} (160 caracteres no primeiro, 153
            nos seguintes). Texto curto economiza.
          </p>
        )}
        {variants.map((variant, index) => (
          <label key={index} className="block">
            <span className={labelClass}>Variação {index + 2} (cada pessoa recebe um dos textos)</span>
            <textarea className={textareaClass} rows={3} value={variant} onChange={(e) => setVariants((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))} />
          </label>
        ))}
        {variants.length < 2 && (
          <button type="button" onClick={() => setVariants((prev) => [...prev, ""])} className="text-sm font-medium text-emerald-700 dark:text-emerald-400 underline underline-offset-2">
            + Adicionar variação do texto
          </button>
        )}
        {sample && (
          <BroadcastPreview label="Prévia (com dados de exemplo e o rodapé obrigatório)">
            {channel === "EMAIL" && subject.trim() && <p className="mb-2 font-semibold">{applyBroadcastVariables(subject, sampleVars)}</p>}
            {sample}
            {FOOTER_SAMPLE.replace(/x{42}/, "…")}
          </BroadcastPreview>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {missing ??
            `Envio em lotes, seg–sex 9h–17h. SMS e e-mail não correm risco de bloqueio do número, então não esperam os 4–6 min do WhatsApp.`}
        </p>
        <button type="submit" disabled={busy || Boolean(missing)} className={primaryBtn}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Criar rascunho
        </button>
      </div>
    </form>
  );
}

const CONSENT_SOURCES = ["Ficha de cadastro (papel)", "Formulário do site", "Pessoalmente na recepção", "Outro"] as const;

/** Registro de aceites de SMS/e-mail — só a gestão abre (o servidor também confere). A origem
 * é a prova do consentimento (LGPD), por isso vem de uma lista + detalhe. */
export function ChannelConsentDialog({
  open,
  onOpenChange,
  setup,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setup: ChannelSetup | null;
  onDone: () => void;
}) {
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [raw, setRaw] = useState("");
  const [sourceKind, setSourceKind] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalidLines, setInvalidLines] = useState<string[]>([]);

  const parsed = raw.trim() ? parseConsentList(channel, raw) : { addresses: [], invalid: [] };
  const source = sourceKind === "Outro" ? detail.trim() : [sourceKind, detail.trim()].filter(Boolean).join(" — ");

  async function submit() {
    setBusy(true);
    try {
      const result = await registerChannelConsents(channel, raw, source);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Aceites registrados: ${result.created} novos, ${result.renewed} renovados, ${result.already} já existiam.`);
      setInvalidLines(result.invalid);
      setRaw("");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar os aceites.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aceites de SMS e e-mail</DialogTitle>
          <DialogDescription>
            Só recebe campanha por SMS ou e-mail quem aceitou aquele canal. O aceite do WhatsApp não vale aqui.
            {setup ? ` Hoje: ${setup.sms.consents} de SMS, ${setup.email.consents} de e-mail.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Canal</span>
              <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                <option value="EMAIL">E-mail</option>
                <option value="SMS">SMS</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>
                De onde veio o aceite <span className="text-red-600" aria-hidden>*</span>
              </span>
              <select className={inputClass} value={sourceKind} onChange={(e) => setSourceKind(e.target.value)} required aria-required="true">
                <option value="">Escolha…</option>
                {CONSENT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={labelClass}>{sourceKind === "Outro" ? "Descreva a origem *" : "Detalhe (opcional) — ex.: fichas de outubro/2026"}</span>
            <input className={inputClass} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>{channel === "EMAIL" ? "E-mails" : "Telefones"} de quem aceitou — um por linha</span>
            <textarea
              className={textareaClass}
              rows={5}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setInvalidLines([]);
              }}
              placeholder={channel === "EMAIL" ? "maria@exemplo.com\njoao@exemplo.com" : "(77) 99999-1234\n77 98888-4321"}
            />
          </label>
          {raw.trim() && (
            <p className="text-sm text-slate-700 dark:text-slate-200" aria-live="polite">
              {parsed.addresses.length} {parsed.addresses.length === 1 ? "endereço válido" : "endereços válidos"}
              {parsed.invalid.length > 0 && <span className="text-amber-700 dark:text-amber-400"> · {parsed.invalid.length} linha(s) não entendida(s): {parsed.invalid.slice(0, 5).join(", ")}</span>}
            </p>
          )}
          {invalidLines.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">Ficaram de fora: {invalidLines.join(", ")}</p>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={busy || parsed.addresses.length === 0 || !source} className={primaryBtn}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Registrar {parsed.addresses.length || ""} aceite(s)
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

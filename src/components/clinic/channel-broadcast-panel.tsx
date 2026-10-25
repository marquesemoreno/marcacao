"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, Mail, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { createClinicChannelCampaign, getChannelSetup, registerChannelConsents } from "@/actions/clinic-channel-broadcast";
import { smsCredits } from "@/lib/broadcast-channel";
import { applyBroadcastVariables } from "@/lib/broadcast-csv";

const inputClass =
  "w-full mt-1 h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500";
const textareaClass = `${inputClass} h-auto py-2`;
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-400";
const primaryBtn =
  "inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg";

type Channel = "SMS" | "EMAIL";
type Setup = Awaited<ReturnType<typeof getChannelSetup>>;

const CHANNEL_LABEL: Record<Channel, string> = { SMS: "SMS", EMAIL: "E-mail" };
const CSV_HINT: Record<Channel, string> = {
  SMS: "telefone,nome,procedimento\n77999991234,Maria,retorno",
  EMAIL: "email,nome,procedimento\nmaria@exemplo.com,Maria,retorno",
};

/** Disparos por SMS e e-mail: cria a campanha (rascunho — o início passa pela mesma confirmação
 * das campanhas de WhatsApp, acima na página) e registra os aceites de cada canal. Só envia a
 * quem tem consentimento POR CANAL (LGPD). */
export function ChannelBroadcastPanel() {
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);

  const loadSetup = useCallback(() => {
    getChannelSetup().then(setSetup).catch(() => {});
  }, []);
  useEffect(() => {
    if (open && !setup) loadSetup();
  }, [open, setup, loadSetup]);

  return (
    <section className="mt-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" aria-label="Disparos por SMS e e-mail">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Mail className="w-4 h-4" aria-hidden /> Disparos por SMS e e-mail
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-8 border-t border-slate-200 dark:border-slate-800 p-4">
          <SetupStatus setup={setup} />
          <ConsentForm onDone={loadSetup} />
          <CampaignForm />
        </div>
      )}
    </section>
  );
}

function SetupStatus({ setup }: { setup: Setup | null }) {
  if (!setup) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["SMS", "EMAIL"] as const).map((channel) => {
        const info = channel === "SMS" ? setup.sms : setup.email;
        const ready = info.missing.length === 0;
        return (
          <div key={channel} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-sm">
            <p className="font-medium text-slate-900 dark:text-slate-100">{CHANNEL_LABEL[channel]}</p>
            <p className={ready ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
              {ready ? "Pronto para enviar" : `Ainda não configurado no servidor (faltam: ${info.missing.join(", ")})`}
            </p>
            <p className="text-slate-600 dark:text-slate-400">{info.consents} {info.consents === 1 ? "aceite ativo" : "aceites ativos"}</p>
          </div>
        );
      })}
    </div>
  );
}

function ConsentForm({ onDone }: { onDone: () => void }) {
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [raw, setRaw] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const result = await registerChannelConsents(channel, raw, source);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Aceites registrados: ${result.created} novos, ${result.renewed} renovados, ${result.already} já existiam.${result.invalidCount ? ` ${result.invalidCount} linha(s) não entendida(s): ${result.invalid.join(", ")}.` : ""}`
      );
      setRaw("");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar os aceites.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">1. Registrar aceites (só gestão)</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Só recebe SMS ou e-mail quem aceitou receber por aquele canal. O aceite do WhatsApp não vale aqui. Cole os endereços de quem aceitou
          (um por linha) e diga de onde veio o aceite.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Canal</span>
          <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            <option value="EMAIL">E-mail</option>
            <option value="SMS">SMS</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>De onde veio o aceite *</span>
          <input className={inputClass} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ex.: ficha de papel 10/2026" />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>{channel === "EMAIL" ? "E-mails" : "Telefones"} de quem aceitou</span>
        <textarea
          className={textareaClass}
          rows={5}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={channel === "EMAIL" ? "maria@exemplo.com\njoao@exemplo.com" : "(77) 99999-1234\n77 98888-4321"}
        />
      </label>
      <button type="submit" disabled={busy || !raw.trim() || !source.trim()} className={primaryBtn}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Registrar aceites
      </button>
    </form>
  );
}

function CampaignForm() {
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [template, setTemplate] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);

  // Aviso de tamanho do SMS com um destinatário de exemplo (o link de sair ocupa ~85 caracteres).
  const smsSample = applyBroadcastVariables(template, { nome: "Maria", procedimento: "consulta", data: "10/11" });
  const smsEstimate = smsCredits(`${smsSample}\nRT: Dr. Nome Sobrenome — CRM-BA 12345\nSair: https://conectasaudevc.com.br/api/u/${"x".repeat(42)}`);

  async function submit() {
    setBusy(true);
    try {
      const result = await createClinicChannelCampaign({
        channel,
        name,
        subject,
        messageTemplate: template,
        extraVariants: variants,
        csv,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const dropped = [result.invalid ? `${result.invalid} inválido(s)` : "", result.duplicates ? `${result.duplicates} repetido(s)` : ""].filter(Boolean).join(", ");
      toast.success(
        `Rascunho criado com ${result.total} destinatário(s)${dropped ? ` (descartados: ${dropped})` : ""}. ${result.withConsent} já têm aceite. Inicie pela lista de campanhas acima.`
      );
      setName("");
      setSubject("");
      setTemplate("");
      setVariants([]);
      setCsv("");
      window.dispatchEvent(new Event("broadcast:changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a campanha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <MessageSquareText className="w-4 h-4" aria-hidden /> 2. Nova campanha por SMS ou e-mail
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Cria um rascunho. O envio começa só quando você clicar em Iniciar na lista de campanhas. Todo envio leva o responsável técnico (CFM) e um
          link para o paciente sair da lista.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Canal</span>
          <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            <option value="EMAIL">E-mail</option>
            <option value="SMS">SMS</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Nome da campanha *</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      {channel === "EMAIL" && (
        <label className="block">
          <span className={labelClass}>Assunto * (aceita {"{{nome}}"})</span>
          <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
      )}
      <label className="block">
        <span className={labelClass}>Mensagem * (variáveis: {"{{nome}}"}, {"{{procedimento}}"}… = colunas do CSV)</span>
        <textarea className={textareaClass} rows={5} value={template} onChange={(e) => setTemplate(e.target.value)} />
      </label>
      {channel === "SMS" && template.trim() && (
        <p className={`text-xs ${smsEstimate > 1 ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
          Com o responsável técnico e o link para sair, cada SMS deve consumir cerca de {smsEstimate} {smsEstimate === 1 ? "crédito" : "créditos"} (160 caracteres no
          primeiro, 153 em cada seguinte). Texto curto economiza.
        </p>
      )}
      {variants.map((variant, index) => (
        <label key={index} className="block">
          <span className={labelClass}>Variação {index + 2} (cada pessoa recebe um dos textos)</span>
          <textarea
            className={textareaClass}
            rows={4}
            value={variant}
            onChange={(e) => setVariants((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
          />
        </label>
      ))}
      {variants.length < 2 && (
        <button type="button" onClick={() => setVariants((prev) => [...prev, ""])} className="text-sm font-medium text-emerald-700 dark:text-emerald-400 underline underline-offset-2">
          + Adicionar variação do texto
        </button>
      )}
      <label className="block">
        <span className={labelClass}>Lista (CSV) * — {channel === "EMAIL" ? "coluna email" : "coluna telefone"}, mais as colunas das variáveis</span>
        <textarea className={`${textareaClass} font-mono`} rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={CSV_HINT[channel]} />
      </label>
      <button type="submit" disabled={busy || !name.trim() || !template.trim() || !csv.trim() || (channel === "EMAIL" && !subject.trim())} className={primaryBtn}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Criar rascunho
      </button>
    </form>
  );
}

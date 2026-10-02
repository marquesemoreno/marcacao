"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, UserPlus, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  cpfInputError,
  maskCpfInput,
  maskWhatsAppInput,
  normalizeWhatsAppInput,
  whatsAppInputError,
} from "@/lib/contact-form";
import type { NewContactExtra } from "@/lib/new-contact-extra";

export type NewContactInput = { name: string; phone: string; clinicId?: string; extra: NewContactExtra };
type ExistingContact = { name: string; conversationId: string | null } | null;

const inputClass =
  "w-full mt-1 h-10 px-3 text-sm rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-200";

/** Modal "Novo Contato" (F2) — único pra Contatos e Inbox (antes eram dois diferentes).
 * Rótulos ligados aos campos, máscara/validação do WhatsApp com erro em linha, aviso de
 * número já cadastrado com atalho pra abrir, e "Mais dados" opcional (CPF/nascimento/
 * convênio). Esc, clique fora e o X fecham (Dialog do base-ui). */
export function NewContactDialog({
  open,
  onOpenChange,
  clinics,
  onCreate,
  onCheckPhone,
  onOpenExisting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Só na visão admin (escolhe a clínica). */
  clinics?: { id: string; tradeName: string }[];
  onCreate: (input: NewContactInput) => Promise<void>;
  onCheckPhone: (phone: string, clinicId?: string) => Promise<ExistingContact>;
  /** Abre o contato já existente; conversationId null = existe em outra clínica (cria a conversa). */
  onOpenExisting: (existing: NonNullable<ExistingContact>, input: NewContactInput) => Promise<void>;
}) {
  const ids = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [convenio, setConvenio] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [existing, setExisting] = useState<ExistingContact>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName(""); setPhone(""); setClinicId(""); setCpf(""); setBirthDate(""); setConvenio("");
      setShowMore(false); setTouchedPhone(false); setExisting(null);
    }
  }, [open]);

  const phoneError = whatsAppInputError(phone);
  const cpfError = cpfInputError(cpf);
  const needsClinic = Boolean(clinics && clinics.length > 0);

  // Checa duplicidade assim que o número fica completo e válido.
  useEffect(() => {
    if (phoneError || (needsClinic && !clinicId)) {
      setExisting(null);
      return;
    }
    let cancelled = false;
    onCheckPhone(normalizeWhatsAppInput(phone), clinicId || undefined)
      .then((found) => !cancelled && setExisting(found))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phone, clinicId, phoneError, needsClinic, onCheckPhone]);

  const input = (): NewContactInput => ({
    name: name.trim(),
    phone: normalizeWhatsAppInput(phone),
    clinicId: clinicId || undefined,
    extra: { cpf: cpf || undefined, birthDate: birthDate || undefined, convenio: convenio || undefined },
  });

  async function run(action: () => Promise<void>) {
    setSaving(true);
    try {
      await action();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o contato.");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouchedPhone(true);
    if (name.trim().length < 2 || phoneError || cpfError || (needsClinic && !clinicId)) return;
    if (existing) return; // decide pelo aviso (abrir existente)
    run(() => onCreate(input()));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl p-6"
        showCloseButton={false}
        initialFocus={nameRef}
      >
        <DialogClose
          aria-label="Fechar"
          title="Fechar"
          render={
            <button className="absolute top-2 right-2 size-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800" />
          }
        >
          <X className="w-5 h-5" />
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-600" />
            Novo contato
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2" noValidate>
          <div>
            <label htmlFor={`${ids}-name`} className={labelClass}>Nome</label>
            <input
              ref={nameRef}
              id={`${ids}-name`}
              type="text"
              autoComplete="off"
              placeholder="Ex.: Maria da Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} border-slate-200 dark:border-slate-800`}
            />
          </div>

          <div>
            <label htmlFor={`${ids}-phone`} className={labelClass}>WhatsApp</label>
            <input
              id={`${ids}-phone`}
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ex.: (77) 9 9999-9999"
              value={phone}
              onChange={(e) => setPhone(maskWhatsAppInput(e.target.value))}
              onBlur={() => setTouchedPhone(true)}
              aria-invalid={touchedPhone && !!phoneError}
              aria-describedby={`${ids}-phone-msg`}
              className={`${inputClass} ${touchedPhone && phoneError ? "border-rose-400 dark:border-rose-700" : "border-slate-200 dark:border-slate-800"}`}
            />
            <p id={`${ids}-phone-msg`} className="mt-1 text-xs min-h-4">
              {touchedPhone && phoneError ? (
                <span className="text-rose-600 dark:text-rose-400">{phoneError}</span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">DDD + 9 dígitos.</span>
              )}
            </p>
            {existing && (
              <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 space-y-2">
                <p>
                  Este número já está cadastrado como <strong>{existing.name}</strong>.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => run(() => onOpenExisting(existing, input()))}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Abrir contato existente
                </button>
              </div>
            )}
          </div>

          {needsClinic && (
            <div>
              <label htmlFor={`${ids}-clinic`} className={labelClass}>Clínica</label>
              <select
                id={`${ids}-clinic`}
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                className={`${inputClass} border-slate-200 dark:border-slate-800`}
              >
                <option value="" disabled>Escolha a clínica…</option>
                {clinics!.map((c) => (
                  <option key={c.id} value={c.id}>{c.tradeName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
              Mais dados (opcional)
            </button>
            {showMore && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${ids}-cpf`} className={labelClass}>CPF</label>
                  <input
                    id={`${ids}-cpf`}
                    inputMode="numeric"
                    placeholder="Ex.: 000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                    aria-invalid={!!cpfError}
                    className={`${inputClass} ${cpfError ? "border-rose-400 dark:border-rose-700" : "border-slate-200 dark:border-slate-800"}`}
                  />
                  {cpfError && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{cpfError}</p>}
                </div>
                <div>
                  <label htmlFor={`${ids}-birth`} className={labelClass}>Nascimento</label>
                  <input
                    id={`${ids}-birth`}
                    type="date"
                    value={birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={`${inputClass} border-slate-200 dark:border-slate-800`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`${ids}-convenio`} className={labelClass}>Convênio</label>
                  <input
                    id={`${ids}-convenio`}
                    placeholder="Ex.: Particular, Unimed…"
                    value={convenio}
                    onChange={(e) => setConvenio(e.target.value)}
                    className={`${inputClass} border-slate-200 dark:border-slate-800`}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !!existing}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm rounded-lg"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Salvando…" : "Cadastrar contato"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

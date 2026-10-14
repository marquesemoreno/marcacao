"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, MessageCircle, Phone, UserRound } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getAgendaPatient, type AgendaPatient } from "@/actions/agenda";
import type { AgendaItem, AgendaStatusChoice } from "@/lib/agenda";
import { StatusIcon } from "./status-icon";
import { StatusMenu } from "./status-menu";
import { AGENDA_STATUS_META, formatLongDate, toTitleCase } from "@/lib/agenda-ui";
import { appointmentStatusLabels } from "@/lib/format";

const REMINDER_RESPONSE: Record<string, string> = {
  CONFIRMED: "confirmou",
  CANCELLED: "cancelou",
  RESCHEDULE: "pediu para remarcar",
};

/** Painel lateral ao clicar numa marcação: dados do agendamento, troca de status e atalhos
 * pra ficha completa (/clinic/pacientes/[id]) e pra conversa no Chat. */
export function PatientSheet({
  item,
  onClose,
  onSetStatus,
  onReschedule,
}: {
  item: AgendaItem | null;
  onClose: () => void;
  onSetStatus: (item: AgendaItem, status: AgendaStatusChoice) => Promise<void>;
  onReschedule: (item: AgendaItem) => void;
}) {
  const [patient, setPatient] = useState<AgendaPatient | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setPatient(null);
    setLoading(true);
    getAgendaPatient(item.phone)
      .then(setPatient)
      .catch(() => setPatient(null))
      .finally(() => setLoading(false));
  }, [item]);

  const name = item ? toTitleCase(item.patientName || "Sem nome") : "";

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <UserRound className="w-4 h-4 text-slate-400" aria-hidden />
                {name}
              </SheetTitle>
              <SheetDescription>
                {formatLongDate(item.date)} · {item.time ?? "ordem de chegada"}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {item.status === "RESCHEDULE" && (
                <section className="rounded-lg border border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 p-3 space-y-2">
                  <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">O paciente pediu para remarcar.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onReschedule(item)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 px-3 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                    >
                      <CalendarClock className="w-4 h-4" aria-hidden /> Remarcar
                    </button>
                    {patient?.conversationId && (
                      <Link
                        href={`/clinic/inbox?c=${patient.conversationId}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-violet-800 dark:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                      >
                        <MessageCircle className="w-4 h-4" aria-hidden /> Responder no WhatsApp
                      </Link>
                    )}
                  </div>
                </section>
              )}
              <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 text-sm">
                <Row label="Procedimento" value={item.procedure ? toTitleCase(item.procedure) : "—"} />
                <Row label="Médico" value={item.doctor ? toTitleCase(item.doctor) : "—"} />
                <Row label="Telefone" value={item.phone ?? "Sem telefone"} />
                <Row label="Origem" value={item.source === "BRIDGE" ? "Sistema da clínica" : "Conecta Saúde"} />
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  Status:
                  <span className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-xs font-semibold ${AGENDA_STATUS_META[item.status].badge}`}>
                    <StatusIcon status={item.status} className="w-3 h-3" />
                    {AGENDA_STATUS_META[item.status].label}
                    {item.isManual ? " (marcado à mão)" : ""}
                  </span>
                </h3>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-1">
                  <StatusMenu
                    item={item}
                    disabled={saving}
                    onPick={async (s) => {
                      setSaving(true);
                      try {
                        await onSetStatus(item, s);
                      } finally {
                        setSaving(false);
                      }
                    }}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  O status vem da resposta do paciente ao lembrete do WhatsApp; o que a recepção marca aqui tem prioridade. Fica salvo
                  só no Conecta — o sistema da clínica não é alterado.
                </p>
              </section>

              <section className="space-y-2">
                {loading ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Buscando conversa e histórico…
                  </p>
                ) : patient?.conversationId ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/clinic/inbox?c=${patient.conversationId}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                    >
                      <MessageCircle className="w-3.5 h-3.5" aria-hidden /> Abrir conversa no Chat
                    </Link>
                    <Link
                      href={`/clinic/pacientes/${patient.conversationId}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    >
                      Ficha completa
                    </Link>
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Phone className="w-3.5 h-3.5" aria-hidden />
                    {item.phone ? "Ainda não há conversa no WhatsApp com este número." : "Sem telefone cadastrado no sistema da clínica."}
                  </p>
                )}
                {patient?.assignedTo && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Conversa com {patient.assignedTo}</p>
                )}
              </section>

              {patient && (patient.reminders.length > 0 || patient.appointments.length > 0) && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Histórico</h3>
                  <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                    {patient.reminders.map((r, i) => (
                      <li key={`r${i}`}>
                        Lembrete em {new Date(r.sentAt).toLocaleDateString("pt-BR")}
                        {r.response ? ` — ${REMINDER_RESPONSE[r.response] ?? r.response}` : " — sem resposta"}
                      </li>
                    ))}
                    {patient.appointments.map((a, i) => (
                      <li key={`a${i}`}>
                        {a.date.split("-").reverse().join("/")} {a.time ?? ""} · {a.procedure} ·{" "}
                        {appointmentStatusLabels[a.status as keyof typeof appointmentStatusLabels] ?? a.status}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800 dark:text-slate-100">{value}</span>
    </p>
  );
}

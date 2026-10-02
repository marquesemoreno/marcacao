"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarPlus, ClipboardList, Copy, FileText, KanbanSquare, MessageCircle, MoreHorizontal, Pencil, ShieldCheck,
  History, Download, File as FileIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AvatarBadge } from "@/components/chat/avatar-badge";
import { ScheduleModal } from "@/components/chat/schedule-modal";
import { displayName } from "@/lib/contact-display";
import { formatCpf, formatPhone } from "@/lib/format";
import type { PatientProfile } from "@/actions/patient-profile";
import {
  getClinicDoctorAgenda, listClinicConveniosForAppointment, listClinicDoctorsForAppointment, listClinicPatientsForAppointment,
  listClinicProceduresForAppointment, sendMessage, updateContactInfo, updateConversationFunnelStage,
} from "@/actions/inbox";

const STAGE_LABEL: Record<string, string> = { NOVOS: "Novo", TRIAGEM: "Em atendimento", ORCAMENTO: "Orçamento", AGENDADO: "Agendado" };
const CONSENT: Record<string, { label: string; tone: string }> = {
  ACCEPTED: { label: "Consentimento LGPD (IA): aceito via WhatsApp", tone: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800" },
  DECLINED: { label: "Consentimento LGPD (IA): recusado", tone: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800" },
  PENDING: { label: "Consentimento LGPD (IA): aguardando resposta", tone: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800" },
  NOT_ASKED: { label: "Sem registro de consentimento", tone: "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
};
const APPT_STATUS: Record<string, string> = { agendada: "Agendada", confirmada: "Confirmada", concluida: "Realizada", cancelada: "Cancelada", no_show: "Faltou" };

const card = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5";
const pill = "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium";

function ageFrom(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(`${birth}T12:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}
const fmtDate = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

type EditableField = "name" | "cpf" | "rg" | "birthDate" | "address" | "convenio" | "insuranceCardNumber" | "preferredDoctor" | "notes";
const FIELDS: { key: EditableField; label: string; type?: string }[] = [
  { key: "name", label: "Nome" },
  { key: "cpf", label: "CPF" },
  { key: "rg", label: "RG" },
  { key: "birthDate", label: "Nascimento", type: "date" },
  { key: "convenio", label: "Convênio" },
  { key: "insuranceCardNumber", label: "Nº da carteirinha" },
  { key: "preferredDoctor", label: "Médico de referência" },
  { key: "address", label: "Endereço" },
  { key: "notes", label: "Observações" },
];

/** N1 — ficha do paciente como página (substitui a gaveta). */
export function PatientPage({ profile }: { profile: PatientProfile }) {
  const router = useRouter();
  const p = profile;
  const name = displayName(p.contact);
  const age = ageFrom(p.contact.birthDate);
  const nextAppointment = p.appointments.find((a) => a.isUpcoming);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<EditableField, string>>(() => ({
    name: p.contact.name ?? "",
    cpf: p.contact.cpf ?? "",
    rg: p.contact.rg ?? "",
    birthDate: p.contact.birthDate ?? "",
    address: p.contact.address ?? "",
    convenio: p.contact.convenio ?? "",
    insuranceCardNumber: p.contact.insuranceCardNumber ?? "",
    preferredDoctor: p.contact.preferredDoctor ?? "",
    notes: p.contact.notes ?? "",
  }));
  const [scheduling, setScheduling] = useState(false);
  const consent = CONSENT[p.consent] ?? CONSENT.NOT_ASKED;

  const valueOf = (key: EditableField): string => {
    const v = p.contact[key];
    if (!v) return "—";
    if (key === "cpf") return formatCpf(v);
    if (key === "birthDate") return `${fmtDate(`${v}T12:00:00Z`)}${age !== null ? ` (${age} anos)` : ""}`;
    return v;
  };

  async function handleSave() {
    if (form.name.trim().length < 2) {
      toast.error("Informe o nome.");
      return;
    }
    setSaving(true);
    try {
      await updateContactInfo(p.conversationId, {
        name: form.name.trim(),
        cpf: form.cpf || undefined,
        rg: form.rg || undefined,
        birthDate: form.birthDate || undefined,
        address: form.address || undefined,
        convenio: form.convenio || undefined,
        insuranceCardNumber: form.insuranceCardNumber || undefined,
        preferredDoctor: form.preferredDoctor || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Cadastro atualizado.");
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const timelinePreview = useMemo(() => p.timeline.slice(0, 5), [p.timeline]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-5">
        <Link href="/clinic/contatos" className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Contatos
        </Link>

        {/* Cabeçalho */}
        <header className={`${card} flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
          <div className="flex items-start gap-4 min-w-0">
            <AvatarBadge name={name} photoUrl={p.contact.photoUrl ?? ""} size={56} />
            <div className="min-w-0 space-y-2">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</h1>
              <div className="flex flex-wrap gap-1.5">
                <span className={`${pill} text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800`}>
                  {p.status === "RESOLVED" ? "Finalizado" : STAGE_LABEL[p.stage] ?? p.stage}
                </span>
                <span className={`${pill} ${consent.tone}`} title="Consentimento registrado para atendimento automatizado (IA) nesta conversa">
                  <ShieldCheck className="w-3 h-3" /> {consent.label}
                </span>
                {p.acquisitionChannel && (
                  <span className={`${pill} text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700`}>
                    Origem: {p.acquisitionChannel}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-4 gap-y-1">
                {age !== null && <span>{age} anos</span>}
                <span>{p.contact.phone ? formatPhone(p.contact.phone) : p.contact.instagramUsername ? `@${p.contact.instagramUsername}` : "Sem telefone"}</span>
                {p.contact.convenio && <span>{p.contact.convenio}</span>}
                <span>Paciente desde {fmtDate(p.contact.patientSince)}</span>
                <span>Atendente: {p.attendant ?? "Não atribuída"}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/clinic/inbox?c=${p.conversationId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              <MessageCircle className="w-4 h-4" /> Abrir conversa
            </Link>
            {p.contact.phone && (
              <button
                type="button"
                onClick={() => setScheduling(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <CalendarPlus className="w-4 h-4" /> Agendar
              </button>
            )}
            <Popover>
              <PopoverTrigger
                aria-label="Mais ações"
                className="size-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <MoreHorizontal className="w-4 h-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1.5">
                {p.contact.phone && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(p.contact.phone!).then(() => toast.success("Telefone copiado."))}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Copy className="w-4 h-4" /> Copiar telefone
                  </button>
                )}
                <Link href="/clinic/crm" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                  <KanbanSquare className="w-4 h-4" /> Ver no CRM
                </Link>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Pencil className="w-4 h-4" /> Editar cadastro
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <Tabs defaultValue="resumo" className="gap-4">
          <div className="overflow-x-auto">
            <TabsList className="h-auto w-max [&>*]:whitespace-nowrap">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="conversa">Conversa ({p.messageCount})</TabsTrigger>
              <TabsTrigger value="agendamentos">Agendamentos ({p.appointments.length})</TabsTrigger>
              <TabsTrigger value="documentos">Documentos e exames ({p.media.length})</TabsTrigger>
              <TabsTrigger value="timeline">Linha do tempo ({p.timeline.length})</TabsTrigger>
            </TabsList>
          </div>

          {/* Resumo */}
          <TabsContent value="resumo" className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
            <section className={card}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Dados cadastrais</h2>
                {!editing && (
                  <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <Pencil className="w-4 h-4" /> Editar
                  </button>
                )}
              </div>
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                  }}
                  className="space-y-3"
                >
                  {FIELDS.map((f) => (
                    <div key={f.key} className="grid grid-cols-1 sm:grid-cols-[180px_1fr] sm:items-center gap-1 sm:gap-3">
                      <label htmlFor={`pf-${f.key}`} className="text-sm text-slate-600 dark:text-slate-300">{f.label}</label>
                      {f.key === "notes" ? (
                        <textarea
                          id={`pf-${f.key}`}
                          rows={3}
                          value={form[f.key]}
                          onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        />
                      ) : (
                        <input
                          id={`pf-${f.key}`}
                          type={f.type ?? "text"}
                          value={form[f.key]}
                          onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                          className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
                        />
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                      Cancelar
                    </button>
                    <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white disabled:opacity-60">
                      {saving ? "Salvando…" : "Salvar"}
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="grid grid-cols-[180px_1fr] gap-3 py-2 text-sm">
                    <dt className="text-slate-600 dark:text-slate-400">Telefone</dt>
                    <dd className="text-slate-900 dark:text-slate-100">{p.contact.phone ? formatPhone(p.contact.phone) : "—"}</dd>
                  </div>
                  {FIELDS.filter((f) => f.key !== "name").map((f) => (
                    <div key={f.key} className="grid grid-cols-[180px_1fr] gap-3 py-2 text-sm">
                      <dt className="text-slate-600 dark:text-slate-400">{f.label}</dt>
                      <dd className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">{valueOf(f.key)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <div className="space-y-4">
              <section className={card}>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">Próximo agendamento</h2>
                {nextAppointment ? (
                  <div className="text-sm space-y-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{nextAppointment.specialty}</p>
                    <p className="text-slate-600 dark:text-slate-300">{nextAppointment.date} · {nextAppointment.doctor}</p>
                    <p className="text-slate-600 dark:text-slate-300">{APPT_STATUS[nextAppointment.status] ?? nextAppointment.status}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum agendamento futuro registrado no Conecta Saúde.</p>
                )}
              </section>
              <section className={card}>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">Linha do tempo</h2>
                <TimelineList events={timelinePreview} />
              </section>
            </div>
          </TabsContent>

          {/* Conversa (somente leitura) */}
          <TabsContent value="conversa" className={card}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {p.messageCount > p.messages.length ? `Últimas ${p.messages.length} de ${p.messageCount} mensagens.` : `${p.messageCount} mensagem(ns).`} Somente leitura.
              </p>
              <Link href={`/clinic/inbox?c=${p.conversationId}`} className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Responder no chat →
              </Link>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-1">
              {p.messages.length === 0 && <p className="text-sm text-slate-500">Nenhuma mensagem.</p>}
              {p.messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[15px] break-words [overflow-wrap:anywhere] ${
                      m.direction === "OUTBOUND"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-slate-900 dark:text-slate-100"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {m.mediaUrl && m.mimeType?.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.mediaUrl} alt={m.attachmentName ?? "Imagem"} className="mb-1 max-h-60 rounded-lg" />
                    ) : m.mediaUrl ? (
                      <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mb-1 inline-flex items-center gap-1 text-sm underline">
                        <FileIcon className="w-4 h-4" /> {m.attachmentName ?? (m.type === "AUDIO" ? "Áudio" : "Arquivo")}
                      </a>
                    ) : null}
                    {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {fmtDateTime(m.at)}
                      {m.author ? ` · ${m.author}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Agendamentos */}
          <TabsContent value="agendamentos" className={card}>
            {!p.hasClinicSystem ? null : (
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Mostra os agendamentos registrados no Conecta Saúde (pelo painel ou pela integração). Marcações feitas direto no
                sistema da clínica não aparecem aqui.
              </p>
            )}
            {p.appointments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum agendamento registrado.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {p.appointments.map((a) => (
                  <li key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900 dark:text-slate-100">{a.specialty}</span>
                      <span className="text-slate-600 dark:text-slate-300">{a.date} · {a.doctor}</span>
                    </span>
                    <span className="inline-flex items-center gap-3">
                      {a.price && <span className="text-slate-600 dark:text-slate-300">{a.price}</span>}
                      <span className={`${pill} text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700`}>
                        {APPT_STATUS[a.status] ?? a.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Documentos e exames */}
          <TabsContent value="documentos" className={card}>
            {p.media.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum arquivo trocado nesta conversa.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {p.media.map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3">
                    {m.mimeType?.startsWith("image/") && m.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.attachmentName ?? "Imagem"} className="w-14 h-14 rounded object-cover" />
                    ) : (
                      <FileText className="w-8 h-8 text-slate-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.attachmentName ?? "Arquivo"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{m.createdAt}{m.attachmentSize ? ` · ${m.attachmentSize}` : ""}</p>
                    </div>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noreferrer" aria-label={`Baixar ${m.attachmentName ?? "arquivo"}`} className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Linha do tempo */}
          <TabsContent value="timeline" className={card}>
            <TimelineList events={p.timeline} />
          </TabsContent>
        </Tabs>
      </div>

      {scheduling && p.contact.phone && (
        <ScheduleModal
          contact={{ name, cpf: p.contact.cpf ?? "", phone: p.contact.phone }}
          isOpen={scheduling}
          onClose={() => setScheduling(false)}
          fetchProcedures={listClinicProceduresForAppointment}
          fetchDoctors={listClinicDoctorsForAppointment}
          fetchConvenios={listClinicConveniosForAppointment}
          fetchAgenda={getClinicDoctorAgenda}
          fetchPatients={listClinicPatientsForAppointment}
          onConfirmSchedule={async (data) => {
            const isBridge = data.appointmentId.startsWith("bridge:");
            const guide = isBridge ? "" : `\n\n📎 Guia com QR Code enviada ao paciente pelo WhatsApp: ${window.location.origin}/comprovante/${data.appointmentId}`;
            await sendMessage(p.conversationId, `✅ Consulta confirmada!\n${data.specialty} — ${data.doctor}\nData: ${data.date} às ${data.time}\nValor: ${data.price}${guide}`, true);
            await updateConversationFunnelStage(p.conversationId, "agendado");
            toast.success("Agendamento confirmado!");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TimelineList({ events }: { events: PatientProfile["timeline"] }) {
  if (events.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">Nada registrado ainda.</p>;
  return (
    <ol className="relative border-l border-slate-200 dark:border-slate-800 ml-2 space-y-4">
      {events.map((e, i) => (
        <li key={i} className="ml-4">
          <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <p className="text-sm text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {e.title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {fmtDateTime(e.at)}
            {e.detail ? ` · ${e.detail}` : ""}
            {e.author ? ` · ${e.author}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

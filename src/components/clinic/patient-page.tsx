"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendBookingConfirmation } from "@/actions/booking-confirmation";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarPlus, ClipboardList, Copy, FileText, KanbanSquare, MessageCircle, Pencil, ShieldCheck,
  History, Download, File as FileIcon, CalendarClock, UserRound, Megaphone, Phone, IdCard, Cake, ShieldPlus, CreditCard,
  Stethoscope, MapPin, StickyNote, type LucideIcon,
} from "lucide-react";
import { HighlightTile } from "@/components/clinic/report-hero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
const CONSENT: Record<string, { label: string; short: string; tone: string }> = {
  ACCEPTED: { label: "Consentimento LGPD (IA): aceito via WhatsApp", short: "IA: consentiu", tone: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800" },
  DECLINED: { label: "Consentimento LGPD (IA): recusado", short: "IA: recusou", tone: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800" },
  PENDING: { label: "Consentimento LGPD (IA): aguardando resposta", short: "IA: aguardando", tone: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800" },
  NOT_ASKED: { label: "Sem registro de consentimento", short: "IA: sem registro", tone: "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
};
const APPT_STATUS: Record<string, string> = { agendada: "Agendada", confirmada: "Confirmada", concluida: "Realizada", cancelada: "Cancelada", no_show: "Faltou" };

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
const FIELD_ICON: Record<EditableField, LucideIcon> = {
  name: UserRound,
  cpf: IdCard,
  rg: IdCard,
  birthDate: Cake,
  convenio: ShieldPlus,
  insuranceCardNumber: CreditCard,
  preferredDoctor: Stethoscope,
  address: MapPin,
  notes: StickyNote,
};

/** N1 — ficha do paciente como página (substitui a gaveta). */
export function PatientPage({ profile, autoSchedule = false }: { profile: PatientProfile; autoSchedule?: boolean }) {
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
  // "Agendar" do modal do CRM chega com ?agendar=1 — já abre o agendamento.
  const [scheduling, setScheduling] = useState(autoSchedule && Boolean(profile.contact.phone));
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

  const [tab, setTab] = useState<string>("timeline");
  const openTab = (value: string) => {
    setTab(value);
    document.getElementById("ficha-abas")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const phoneLabel = p.contact.phone ? formatPhone(p.contact.phone) : p.contact.instagramUsername ? `@${p.contact.instagramUsername}` : "Sem telefone";
  const subtitle = [age !== null ? `${age} anos` : null, p.contact.convenio || null].filter(Boolean).join(" · ");
  const futureCount = p.appointments.filter((a) => a.isUpcoming).length;
  const lastMessage = p.messages.length > 0 ? p.messages[p.messages.length - 1] : null;

  return (
    <div className="soft-canvas flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 md:p-8">
        {/* Topo: voltar + título + pílulas com o contexto do paciente */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/clinic/contatos"
              aria-label="Voltar para Contatos"
              className="glass-surface grid size-11 shrink-0 place-items-center !rounded-full text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">Ficha do paciente</h1>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ContextPill icon={CalendarClock} label="Paciente desde" value={fmtDate(p.contact.patientSince)} />
            <ContextPill icon={UserRound} label="Atendente" value={p.attendant ?? "Não atribuída"} />
            <ContextPill icon={Megaphone} label="Origem" value={p.acquisitionChannel ?? "Não identificada"} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr]">
          {/* Grade: perfil e dados na coluna da direita; no celular a ordem é perfil → destaques e histórico → dados */}
            <section aria-labelledby="ficha-nome" className="glass-surface relative overflow-hidden p-5 lg:col-start-2 lg:row-start-1">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-100/80 via-white/0 to-sky-100/70 dark:from-emerald-400/10 dark:via-transparent dark:to-sky-400/10"
              />
              <div className="relative flex flex-col items-center text-center">
                <div className="rounded-full p-1 shadow-[0_12px_28px_-14px_rgb(15_23_42/0.5)] ring-4 ring-white/80 dark:ring-white/10">
                  <AvatarBadge name={name} photoUrl={p.contact.photoUrl ?? ""} size={96} />
                </div>
                <h2 id="ficha-nome" className="mt-3 text-xl font-semibold tracking-tight text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">
                  {name}
                </h2>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{subtitle || phoneLabel}</p>
                {subtitle && <p className="text-sm text-slate-600 dark:text-slate-300">{phoneLabel}</p>}
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  <span className={`${pill} border-transparent bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200`}>
                    {p.status === "RESOLVED" ? "Finalizado" : STAGE_LABEL[p.stage] ?? p.stage}
                  </span>
                  <span className={`${pill} ${consent.tone}`} title={consent.label}>
                    <ShieldCheck className="size-3" aria-hidden /> {consent.short}
                  </span>
                </div>

                {/* Ações rápidas: conversa em destaque (é a principal), as outras em vidro */}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <QuickAction label="Conversa" href={`/clinic/inbox?c=${p.conversationId}`} icon={MessageCircle} primary />
                  {p.contact.phone && <QuickAction label="Agendar" onClick={() => setScheduling(true)} icon={CalendarPlus} />}
                  {p.contact.phone && (
                    <QuickAction
                      label="Copiar"
                      onClick={() => navigator.clipboard.writeText(p.contact.phone!).then(() => toast.success("Telefone copiado."))}
                      icon={Copy}
                    />
                  )}
                  <QuickAction label="CRM" href="/clinic/crm" icon={KanbanSquare} />
                  <QuickAction label="Editar" onClick={() => setEditing(true)} icon={Pencil} />
                </div>
              </div>
            </section>


          {/* Coluna principal: destaques + abas */}
          <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <HighlightTile
                tone="blue"
                title="Próximo agendamento"
                value={nextAppointment ? nextAppointment.date.slice(0, 5) : "—"}
                sub={nextAppointment ? `${nextAppointment.specialty} · ${nextAppointment.doctor}` : "nada marcado no Conecta Saúde"}
                onOpen={() => openTab("agendamentos")}
                linkLabel="Ver agendamentos"
              />
              <HighlightTile
                tone="teal"
                title="Agendamentos"
                value={String(p.appointments.length)}
                sub={futureCount > 0 ? `${futureCount} futuro(s)` : "nenhum futuro"}
                onOpen={() => openTab("agendamentos")}
                linkLabel="Ver agendamentos"
              />
              <HighlightTile
                tone="ink"
                title="Mensagens"
                value={p.messageCount.toLocaleString("pt-BR")}
                sub={lastMessage ? `última em ${fmtDate(lastMessage.at)}` : "nenhuma ainda"}
                onOpen={() => openTab("conversa")}
                linkLabel="Ver conversa"
              />
              <HighlightTile
                tone="sun"
                title="Documentos e exames"
                value={String(p.media.length)}
                sub={p.media.length > 0 ? "trocados pelo WhatsApp" : "nenhum arquivo"}
                onOpen={() => openTab("documentos")}
                linkLabel="Ver documentos e exames"
              />
            </div>

            <section id="ficha-abas" aria-label="Histórico do paciente" className="glass-surface scroll-mt-6 p-4 sm:p-5">
              <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-4">
                <div className="-mx-1 overflow-x-auto overflow-y-hidden px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <TabsList className="!h-auto w-max gap-1 !rounded-full bg-slate-900/5 !p-1 dark:bg-white/5 [&>*]:whitespace-nowrap">
                    {[
                      ["timeline", `Linha do tempo (${p.timeline.length})`],
                      ["conversa", `Conversa (${p.messageCount})`],
                      ["agendamentos", `Agendamentos (${p.appointments.length})`],
                      ["documentos", `Documentos e exames (${p.media.length})`],
                    ].map(([v, l]) => (
                      <TabsTrigger
                        key={v}
                        value={v}
                        className="!rounded-full !border-0 !px-4 !py-1.5 after:!hidden data-[active]:!bg-slate-900 data-[active]:!text-white data-[active]:!shadow-sm dark:data-[active]:!bg-white dark:data-[active]:!text-slate-900"
                      >
                        {l}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* Linha do tempo */}
                <TabsContent value="timeline">
                  <TimelineList events={p.timeline} />
                </TabsContent>

                {/* Conversa (somente leitura) */}
                <TabsContent value="conversa">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {p.messageCount > p.messages.length ? `Últimas ${p.messages.length} de ${p.messageCount} mensagens.` : `${p.messageCount} mensagem(ns).`} Somente leitura.
                    </p>
                    <Link href={`/clinic/inbox?c=${p.conversationId}`} className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      Responder no chat →
                    </Link>
                  </div>
                  <div className="max-h-[60vh] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                    {p.messages.length === 0 && <p className="text-sm text-slate-500">Nenhuma mensagem.</p>}
                    {p.messages.map((m) => (
                      <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[15px] break-words [overflow-wrap:anywhere] ${
                            m.direction === "OUTBOUND"
                              ? "bg-emerald-50 text-slate-900 dark:bg-emerald-950/40 dark:text-slate-100"
                              : "bg-white text-slate-900 ring-1 ring-slate-900/5 dark:bg-white/5 dark:text-slate-100 dark:ring-white/5"
                          }`}
                        >
                          {m.mediaUrl && m.mimeType?.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.mediaUrl} alt={m.attachmentName ?? "Imagem"} className="mb-1 max-h-60 rounded-lg" />
                          ) : m.mediaUrl ? (
                            <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mb-1 inline-flex items-center gap-1 text-sm underline">
                              <FileIcon className="size-4" /> {m.attachmentName ?? (m.type === "AUDIO" ? "Áudio" : "Arquivo")}
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
                <TabsContent value="agendamentos">
                  {p.hasClinicSystem && (
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                      Mostra os agendamentos registrados no Conecta Saúde (pelo painel ou pela integração). Marcações feitas direto no sistema da clínica não aparecem aqui.
                    </p>
                  )}
                  {p.appointments.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum agendamento registrado.</p>
                  ) : (
                    <ul className="space-y-2">
                      {p.appointments.map((a) => (
                        <li key={a.id} className="glass-well flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                          <span className="inline-flex min-w-0 items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-slate-600 ring-1 ring-slate-900/5 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10">
                              <ClipboardList className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium text-slate-900 dark:text-slate-100">{a.specialty}</span>
                              <span className="block text-slate-600 dark:text-slate-300">
                                {a.date} · {a.doctor}
                              </span>
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-3">
                            {a.price && <span className="text-slate-600 dark:text-slate-300">{a.price}</span>}
                            <span
                              className={`${pill} border-transparent ${
                                a.isUpcoming ? "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200" : "bg-slate-900/5 text-slate-700 dark:bg-white/10 dark:text-slate-200"
                              }`}
                            >
                              {APPT_STATUS[a.status] ?? a.status}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                {/* Documentos e exames */}
                <TabsContent value="documentos">
                  {p.media.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum arquivo trocado nesta conversa.</p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {p.media.map((m) => (
                        <li key={m.id} className="glass-well flex items-center gap-3 p-3">
                          {m.mimeType?.startsWith("image/") && m.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.url} alt={m.attachmentName ?? "Imagem"} className="size-14 rounded-xl object-cover" />
                          ) : (
                            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white text-slate-500 dark:bg-white/10 dark:text-slate-300">
                              <FileText className="size-6" aria-hidden />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.attachmentName ?? "Arquivo"}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {m.createdAt}
                              {m.attachmentSize ? ` · ${m.attachmentSize}` : ""}
                            </p>
                          </div>
                          {m.url && (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Baixar ${m.attachmentName ?? "arquivo"}`}
                              className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              <Download className="size-4" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            </section>
          </div>

          <section aria-labelledby="ficha-dados" className="glass-surface self-start p-5 lg:col-start-2 lg:row-start-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="ficha-dados" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Dados cadastrais
              </h2>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="Editar dados cadastrais"
                  className="grid size-9 place-items-center rounded-full bg-white/80 text-slate-700 ring-1 ring-slate-900/5 hover:bg-white dark:bg-white/10 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/15"
                >
                  <Pencil className="size-4" aria-hidden />
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
                  <div key={f.key} className="space-y-1">
                    <label htmlFor={`pf-${f.key}`} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {f.label}
                    </label>
                    {f.key === "notes" ? (
                      <textarea
                        id={`pf-${f.key}`}
                        rows={3}
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    ) : (
                      <input
                        id={`pf-${f.key}`}
                        type={f.type ?? "text"}
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    )}
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setEditing(false)} className="rounded-full px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {saving ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="space-y-3">
                <InfoRow icon={Phone} label="Telefone" value={p.contact.phone ? formatPhone(p.contact.phone) : "—"} />
                {FIELDS.filter((f) => f.key !== "name").map((f) => (
                  <InfoRow key={f.key} icon={FIELD_ICON[f.key]} label={f.label} value={valueOf(f.key)} />
                ))}
              </dl>
            )}
          </section>
        </div>
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
            // Ponte: confirmação formatada ao paciente (Etapa 2.4); catálogo já envia a dele.
            let sent = false;
            if (isBridge && data.sendToPatient !== false) {
              try {
                await sendBookingConfirmation(p.conversationId, {
                  patientName: name,
                  procedure: data.specialty,
                  doctorName: data.doctorName,
                  date: data.date,
                  time: data.rawTime,
                  arrivalOrder: data.arrivalOrder,
                  price: data.priceValue,
                });
                sent = true;
              } catch (error) {
                toast.error(error instanceof Error ? `Agendado, mas a confirmação não saiu: ${error.message}` : "Agendado, mas a confirmação não saiu.");
              }
            }
            if (!sent) {
              const guide = isBridge ? "" : `\n\n📎 Guia com QR Code enviada ao paciente pelo WhatsApp: ${window.location.origin}/comprovante/${data.appointmentId}`;
              const doctor = data.doctorName || data.doctor;
              await sendMessage(
                p.conversationId,
                `✅ Agendado (nota interna)\n${data.specialty}${doctor ? ` — ${doctor}` : ""}\nData: ${data.date.split("-").reverse().join("/")} às ${data.time}${data.priceValue ? `\nValor: ${data.price}` : ""}${guide}`,
                true,
              );
            }
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

/** Pílula de contexto no topo da ficha (paciente desde, atendente, origem). */
function ContextPill({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="glass-surface flex min-w-0 items-center gap-3 !rounded-full py-2 pl-2 pr-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-slate-700 ring-1 ring-slate-900/5 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10">
        <Icon className="size-[1.1rem]" aria-hidden strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </span>
    </div>
  );
}

/** Botão redondo de ação rápida, com o nome embaixo (a recepção não precisa adivinhar o ícone). */
function QuickAction({
  label,
  icon: Icon,
  href,
  onClick,
  primary = false,
}: {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const circle = `grid size-11 place-items-center rounded-full transition-colors ${
    primary
      ? "bg-emerald-600 text-white shadow-[0_10px_20px_-10px_rgb(5_150_105/0.9)] group-hover:bg-emerald-700"
      : "bg-white/90 text-slate-700 ring-1 ring-slate-900/5 group-hover:bg-white dark:bg-white/10 dark:text-slate-100 dark:ring-white/10 dark:group-hover:bg-white/15"
  }`;
  const inner = (
    <>
      <span className={circle}>
        <Icon className="size-[1.1rem]" aria-hidden />
      </span>
      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
    </>
  );
  const cls = "group flex w-[3.25rem] flex-col items-center gap-1.5 rounded-xl focus-visible:outline-offset-4";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Linha de dado cadastral: ícone redondo, rótulo pequeno em cima e o valor embaixo. */
function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-slate-900/5 text-slate-600 dark:bg-white/10 dark:text-slate-300">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
        <dd className={`whitespace-pre-wrap break-words text-sm ${value === "—" ? "text-slate-400 dark:text-slate-500" : "font-medium text-slate-900 dark:text-slate-100"}`}>{value}</dd>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Contact } from '@/types/chat-crm';
import { X, Calendar, Clock, Stethoscope, IdCard, CheckCircle2, UserRound, CreditCard } from 'lucide-react';
import { createAppointment } from '@/actions/appointments';
import { formatCurrency, appointmentTypeLabels } from '@/lib/format';
import type { PlainClinicProcedureItem } from '@/lib/serialize';
import { useDialogA11y } from '@/hooks/use-dialog-a11y';
import { useClickOutside } from '@/hooks/use-click-outside';

type BridgeDoctor = { id: number; nome: string; crm: string; especialidade: string | null };
type BridgeConvenio = { id: number; nome: string };

/** Máscara visual de CPF enquanto digita — "000.000.000-00". */
function formatCpfMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

interface ScheduleModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  /** Clínica-scoped usa a clínica da sessão; Admin passa o clinicId da conversa selecionada.
   * convenioId só existe no fluxo hospitalar — afeta o preço exibido. */
  fetchProcedures: (convenioId?: string) => Promise<PlainClinicProcedureItem[]>;
  /** Só clínicas com integração hospitalar (Santa Clara) retornam médicos — vazio pras demais. */
  fetchDoctors?: () => Promise<BridgeDoctor[]>;
  /** Idem — lista de convênios pra escolher no agendamento hospitalar. */
  fetchConvenios?: () => Promise<BridgeConvenio[]>;
  /** Idem — só quando há integração hospitalar dá pra ver a agenda antes de marcar. */
  fetchAgenda?: (medicoId: number, date: string) => Promise<string[]>;
  onConfirmSchedule: (scheduleData: {
    appointmentId: string;
    specialty: string;
    doctor: string;
    date: string;
    time: string;
    price: string;
  }) => void;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  contact,
  isOpen,
  onClose,
  fetchProcedures,
  fetchDoctors,
  fetchConvenios,
  fetchAgenda,
  onConfirmSchedule,
}) => {
  const [procedures, setProcedures] = useState<PlainClinicProcedureItem[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(false);
  const [procedureId, setProcedureId] = useState('');
  const [doctors, setDoctors] = useState<BridgeDoctor[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [convenios, setConvenios] = useState<BridgeConvenio[]>([]);
  const [convenioId, setConvenioId] = useState('');
  const [patientName, setPatientName] = useState(contact.name);
  const [cpf, setCpf] = useState(contact.cpf || '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timeMode, setTimeMode] = useState<'scheduled' | 'arrival'>('scheduled');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [occupiedTimes, setOccupiedTimes] = useState<string[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [doctorQuery, setDoctorQuery] = useState('');
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const doctorDropdownRef = useClickOutside<HTMLDivElement>(isDoctorDropdownOpen, () => setIsDoctorDropdownOpen(false));

  useEffect(() => {
    if (!isOpen) return;
    setPatientName(contact.name);
    setCpf(contact.cpf || '');
    setProcedureId('');
    setDoctorId('');
    setConvenioId('');
    setDate('');
    setTime('');
    setTimeMode('scheduled');
    setIsSuccess(false);
    setOccupiedTimes([]);
    setDoctorQuery('');
    setIsDoctorDropdownOpen(false);
    setLoadingProcedures(true);
    fetchProcedures()
      .then((items) => {
        setProcedures(items);
        // Só 1 procedimento cadastrado (comum nas clínicas com integração hospitalar,
        // que hoje só oferecem "Consulta") — pré-seleciona pra não obrigar o
        // atendente a escolher algo que não tem outra opção.
        if (items.length === 1) setProcedureId(items[0].id);
      })
      .finally(() => setLoadingProcedures(false));
    fetchDoctors?.().then(setDoctors).catch(() => setDoctors([]));
    fetchConvenios?.()
      .then((items) => {
        setConvenios(items);
        // Pré-seleciona "Particular" (o padrão de sempre) pra não obrigar escolha
        // quando é o caso mais comum — o atendente troca se for outro convênio.
        const particular = items.find((c) => c.nome.trim().toUpperCase() === 'PARTICULAR');
        if (particular) setConvenioId(String(particular.id));
      })
      .catch(() => setConvenios([]));
    // fetchProcedures/fetchDoctors/fetchConvenios são recriadas a cada render do pai — só precisamos rodar quando o modal abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contact.cpf, contact.name]);

  // Convênio afeta o preço exibido do procedimento — rebusca quando o atendente troca.
  useEffect(() => {
    if (!isOpen || !fetchConvenios) return;
    setLoadingProcedures(true);
    fetchProcedures(convenioId || undefined)
      .then(setProcedures)
      .finally(() => setLoadingProcedures(false));
    // Só quando o convênio muda de fato (a busca inicial já roda no efeito de abertura acima).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convenioId]);

  // Busca a agenda do médico assim que ele e a data estiverem escolhidos —
  // mostra o que já está ocupado antes do atendente digitar um horário às cegas.
  useEffect(() => {
    if (!isOpen || !fetchAgenda || !doctorId || !date) {
      setOccupiedTimes([]);
      return;
    }
    let cancelled = false;
    setLoadingAgenda(true);
    fetchAgenda(Number(doctorId), date)
      .then((horarios) => {
        if (!cancelled) setOccupiedTimes(horarios);
      })
      .catch(() => {
        if (!cancelled) setOccupiedTimes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAgenda(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, fetchAgenda, doctorId, date]);

  // Cada procedimento já vem com um jeito padrão de atender (horário marcado ou ordem de
  // chegada) — troca o toggle sozinho quando o atendente escolhe outro procedimento, sem
  // travar: ele ainda pode alternar manualmente depois se preferir o outro modo.
  useEffect(() => {
    const procedure = procedures.find((p) => p.id === procedureId);
    if (!procedure) return;
    setTimeMode(procedure.appointmentType === 'ARRIVAL_ORDER' ? 'arrival' : 'scheduled');
  }, [procedureId, procedures]);

  const dialogRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  const selectedProcedure = procedures.find((p) => p.id === procedureId);
  const requiresDoctor = doctors.length > 0;
  const selectedDoctor = doctors.find((d) => String(d.id) === doctorId);
  const normalizedDoctorQuery = doctorQuery.trim().toLowerCase();
  const filteredDoctors = normalizedDoctorQuery
    ? doctors.filter(
        (d) =>
          d.nome.toLowerCase().includes(normalizedDoctorQuery) ||
          d.crm.toLowerCase().includes(normalizedDoctorQuery) ||
          d.especialidade?.toLowerCase().includes(normalizedDoctorQuery)
      )
    : doctors;
  const hasFullName = patientName.trim().split(/\s+/).filter(Boolean).length >= 2;
  const missingFields = [
    !hasFullName && "nome completo",
    !procedureId && "procedimento",
    !date && "data",
    requiresDoctor && !doctorId && "médico",
  ].filter((field): field is string => Boolean(field));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedureId || !date || !selectedProcedure || !hasFullName) return;
    if (requiresDoctor && !doctorId) return;

    setSubmitting(true);
    try {
      const appointment = await createAppointment({
        patientName,
        patientCpf: cpf,
        patientPhone: contact.phone,
        clinicProcedureId: procedureId,
        date,
        timeSlot: time || undefined,
        medicoId: doctorId || undefined,
        convenioId: convenioId || undefined,
      });

      setIsSuccess(true);
      const price = formatCurrency(selectedProcedure.promotionalPrice ?? selectedProcedure.price);
      setTimeout(() => {
        onConfirmSchedule({
          appointmentId: appointment.id,
          specialty: selectedProcedure.procedure.name,
          doctor: 'Clínica Conecta Saúde',
          date,
          time: time || 'Ordem de chegada',
          price,
        });
        setIsSuccess(false);
        onClose();
      }, 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Painel vira uma coluna de verdade no layout a partir do breakpoint sm (sm:static
    // cancela o fixed) — a conversa (flex-1) encolhe pra abrir espaço, igual já acontece
    // com o painel "Perfil & CRM". Sem fundo escurecido, atendente continua conversando
    // com o paciente enquanto preenche o agendamento. Em telas pequenas continua como
    // modal de tela cheia sobreposto, já que não sobra espaço pra mostrar os dois juntos.
    <div className="fixed sm:static inset-0 sm:inset-auto sm:h-full sm:w-[420px] sm:shrink-0 z-50 sm:z-auto flex items-end sm:items-stretch justify-center p-0 bg-slate-900/60 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
        tabIndex={-1}
        // max-h garante um limite de altura mesmo no modal de tela cheia do mobile — sem
        // isso o rodapé com "Confirmar/Cancelar" podia ficar fora da área visível quando o
        // formulário crescia (médico, convênio, agenda ocupada), sem jeito de rolar até ele.
        className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-none shadow-2xl sm:shadow-none sm:border-l border-slate-100 dark:border-slate-800 max-w-lg sm:max-w-none w-full max-h-[92dvh] sm:max-h-none sm:h-full animate-in slide-in-from-bottom-6 sm:slide-in-from-right duration-200 outline-none flex flex-col"
      >
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold shadow-2xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 id="schedule-modal-title" className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Novo Agendamento Rápido</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[220px] sm:max-w-xs">Paciente: {contact.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 size-11 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors -mr-1.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-8 text-center flex flex-col items-center justify-center gap-3 animate-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Agendamento Confirmado!</h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">
              A consulta foi integrada à agenda médica e a confirmação foi enviada ao paciente pelo WhatsApp.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5 font-mono">
                <UserRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Nome Completo
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nome e sobrenome do paciente"
                className="w-full text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                required
              />
              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                O nome do contato no WhatsApp costuma vir incompleto — confirme ou corrija aqui antes de agendar.
              </p>
            </div>

            {requiresDoctor && (
              <div className="relative" ref={doctorDropdownRef}>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5 font-mono">
                  <UserRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Médico / Especialista
                </label>
                <input
                  type="text"
                  value={
                    isDoctorDropdownOpen
                      ? doctorQuery
                      : selectedDoctor
                        ? `Dr(a). ${selectedDoctor.nome}${selectedDoctor.especialidade ? ` — ${selectedDoctor.especialidade}` : ''}`
                        : doctorQuery
                  }
                  onChange={(e) => {
                    setDoctorQuery(e.target.value);
                    setDoctorId('');
                  }}
                  onFocus={() => {
                    setDoctorQuery('');
                    setIsDoctorDropdownOpen(true);
                  }}
                  placeholder="Digite pra buscar um médico..."
                  className="w-full text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  autoComplete="off"
                  required
                />
                {isDoctorDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    {filteredDoctors.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">Nenhum médico encontrado.</p>
                    ) : (
                      <>
                        {filteredDoctors.slice(0, 50).map((doctor) => (
                          <button
                            key={doctor.id}
                            type="button"
                            onClick={() => {
                              setDoctorId(String(doctor.id));
                              setDoctorQuery('');
                              setIsDoctorDropdownOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                              Dr(a). {doctor.nome} <span className="text-slate-400 dark:text-slate-500">(CRM: {doctor.crm})</span>
                            </p>
                            {doctor.especialidade && (
                              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{doctor.especialidade}</p>
                            )}
                          </button>
                        ))}
                        {filteredDoctors.length > 50 && (
                          <p className="px-3 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 mt-1">
                            +{filteredDoctors.length - 50} médicos — digite pra refinar a busca.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {fetchConvenios && convenios.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5 font-mono">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Convênio
                </label>
                <select
                  value={convenioId}
                  onChange={(e) => setConvenioId(e.target.value)}
                  className="w-full text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                >
                  {convenios.map((convenio) => (
                    <option key={convenio.id} value={convenio.id}>
                      {convenio.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5 font-mono">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Procedimento Médico
              </label>
              <select
                value={procedureId}
                onChange={(e) => setProcedureId(e.target.value)}
                className="w-full text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                required
                disabled={loadingProcedures}
              >
                <option value="" disabled>
                  {loadingProcedures ? 'Carregando opções...' : 'Escolha um procedimento...'}
                </option>
                {procedures.map((procedure) => {
                  const effectivePrice = procedure.promotionalPrice ?? procedure.price;
                  return (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.procedure.name}
                    {/* Preço 0 normalmente é "ainda não cadastrado" (ex: procedimentos vindos da
                        integração hospitalar da Santa Clara) — melhor omitir do que mostrar R$ 0,00. */}
                    {effectivePrice > 0 ? ` — ${formatCurrency(effectivePrice)}` : ''}
                  </option>
                  );
                })}
              </select>
              {selectedProcedure && (
                <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{appointmentTypeLabels[selectedProcedure.appointmentType]}</span>
                  {selectedProcedure.procedure.preparationInstructions &&
                    ` · Preparo: ${selectedProcedure.procedure.preparationInstructions}`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Data
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Horário
                  </label>
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-950 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTimeMode('scheduled')}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                        timeMode === 'scheduled'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      Marcado
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimeMode('arrival');
                        setTime('');
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                        timeMode === 'arrival'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      Chegada
                    </button>
                  </div>
                </div>
                {timeMode === 'scheduled' ? (
                  <>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    {time && occupiedTimes.includes(time) && (
                      <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                        ⚠️ Esse médico já tem uma marcação às {time} nesse dia.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="w-full text-xs sm:text-sm border border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50/50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium">
                    Por ordem de chegada
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5 font-mono">
                  <IdCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> CPF
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpfMask(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full text-xs sm:text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  required
                />
              </div>
            </div>

            {fetchAgenda && doctorId && date && (
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2.5">
                {loadingAgenda ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Consultando agenda do médico...</p>
                ) : occupiedTimes.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 font-mono">
                      Horários já ocupados nesse dia:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {occupiedTimes.map((hora) => (
                        <span
                          key={hora}
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                        >
                          {hora}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                    ✓ Nenhum horário ocupado nesse dia pra esse médico.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 px-5 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-end gap-1.5">
            {!submitting && missingFields.length > 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Falta preencher: {missingFields.join(", ")}
              </p>
            )}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || missingFields.length > 0}
                className="px-5 py-2.5 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl shadow-xs hover:shadow-md transition-all active:scale-[0.99] flex items-center gap-2 min-h-[44px]"
              >
                {submitting ? 'Criando...' : 'Confirmar Agendamento'}
              </button>
            </div>
          </div>
          </form>
        )}
      </div>
    </div>
  );
};


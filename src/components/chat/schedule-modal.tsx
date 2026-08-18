"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Contact } from '@/types/chat-crm';
import { X, Calendar, Clock, Stethoscope, DollarSign, CheckCircle2 } from 'lucide-react';
import { createAppointment } from '@/actions/appointments';
import { formatCurrency, appointmentTypeLabels } from '@/lib/format';
import type { PlainClinicProcedureItem } from '@/lib/serialize';

interface ScheduleModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  /** Clínica-scoped usa a clínica da sessão; Admin passa o clinicId da conversa selecionada. */
  fetchProcedures: () => Promise<PlainClinicProcedureItem[]>;
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
  onConfirmSchedule,
}) => {
  const [procedures, setProcedures] = useState<PlainClinicProcedureItem[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(false);
  const [procedureId, setProcedureId] = useState('');
  const [cpf, setCpf] = useState(contact.cpf || '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCpf(contact.cpf || '');
    setProcedureId('');
    setDate('');
    setTime('');
    setIsSuccess(false);
    setLoadingProcedures(true);
    fetchProcedures()
      .then(setProcedures)
      .finally(() => setLoadingProcedures(false));
    // fetchProcedures é recriada a cada render do pai — só precisamos rodar quando o modal abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contact.cpf]);

  if (!isOpen) return null;

  const selectedProcedure = procedures.find((p) => p.id === procedureId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedureId || !date || !selectedProcedure) return;

    setSubmitting(true);
    try {
      const appointment = await createAppointment({
        patientName: contact.name,
        patientCpf: cpf,
        patientPhone: contact.phone,
        clinicProcedureId: procedureId,
        date,
        timeSlot: time || undefined,
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
    } catch {
      toast.error('Não foi possível criar o agendamento. Confira os dados (CPF precisa ter 11 dígitos).');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Novo Agendamento Rápido</h3>
              <p className="text-xs text-slate-500 truncate max-w-[220px] sm:max-w-xs">Paciente: {contact.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-3 animate-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Agendamento Confirmado!</h4>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xs leading-relaxed">
              A consulta foi integrada à agenda médica e a confirmação foi enviada ao paciente pelo WhatsApp.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5 font-mono">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600" /> Procedimento Médico
              </label>
              <select
                value={procedureId}
                onChange={(e) => setProcedureId(e.target.value)}
                className="w-full text-xs sm:text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                required
                disabled={loadingProcedures}
              >
                <option value="" disabled>
                  {loadingProcedures ? 'Carregando opções...' : 'Escolha um procedimento...'}
                </option>
                {procedures.map((procedure) => (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.procedure.name} — {formatCurrency(procedure.promotionalPrice ?? procedure.price)}
                  </option>
                ))}
              </select>
              {selectedProcedure && (
                <p className="mt-1.5 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="font-semibold text-slate-700">{appointmentTypeLabels[selectedProcedure.appointmentType]}</span>
                  {selectedProcedure.procedure.preparationInstructions &&
                    ` · Preparo: ${selectedProcedure.procedure.preparationInstructions}`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Data
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full text-xs sm:text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>

              {selectedProcedure?.appointmentType === 'SCHEDULED' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" /> Horário
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full text-xs sm:text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5 font-mono">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> CPF
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full text-xs sm:text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !procedureId || !date}
                className="px-5 py-2.5 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl shadow-xs hover:shadow-md transition-all active:scale-[0.99] flex items-center gap-2 min-h-[44px]"
              >
                {submitting ? 'Criando...' : 'Confirmar Agendamento'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};


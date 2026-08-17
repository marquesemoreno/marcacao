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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Novo Agendamento Conecta Saúde</h3>
              <p className="text-xs text-slate-500">Paciente: {contact.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-semibold text-slate-900">Agendamento Confirmado!</h4>
            <p className="text-sm text-slate-600 max-w-xs">
              A consulta foi integrada à agenda médica e a confirmação foi enviada ao paciente pelo WhatsApp.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600" /> Procedimento
              </label>
              <select
                value={procedureId}
                onChange={(e) => setProcedureId(e.target.value)}
                className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
                disabled={loadingProcedures}
              >
                <option value="" disabled>
                  {loadingProcedures ? 'Carregando...' : 'Escolha um procedimento...'}
                </option>
                {procedures.map((procedure) => (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.procedure.name} — {formatCurrency(procedure.promotionalPrice ?? procedure.price)}
                  </option>
                ))}
              </select>
              {selectedProcedure && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {appointmentTypeLabels[selectedProcedure.appointmentType]}
                  {selectedProcedure.procedure.preparationInstructions &&
                    ` · Preparo: ${selectedProcedure.procedure.preparationInstructions}`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Data
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {selectedProcedure?.appointmentType === 'SCHEDULED' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" /> Horário
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> CPF
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !procedureId || !date}
                className="px-4 py-2 text-xs sm:text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg shadow-sm transition-colors flex items-center gap-2"
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

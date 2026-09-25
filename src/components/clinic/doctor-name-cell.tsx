"use client";

import { useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { updateAppointmentDoctor } from "@/actions/clinic";
import { toast } from "sonner";

/** Célula editável inline da coluna "Médico" em /clinic/agendamentos — não existe
 * cadastro de médico no sistema, é texto livre por agendamento (ver comentário no
 * schema em Appointment.doctorName). Popula o seletor do aviso de remarcação em
 * massa conforme a recepção vai preenchendo. */
export function DoctorNameCell({ appointmentId, doctorName }: { appointmentId: string; doctorName: string | null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(doctorName ?? "");
  const [current, setCurrent] = useState(doctorName);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateAppointmentDoctor(appointmentId, value);
      setCurrent(value.trim() || null);
      setIsEditing(false);
    } catch {
      toast.error("Erro ao salvar o médico.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setValue(current ?? "");
              setIsEditing(false);
            }
          }}
          placeholder="Nome do médico"
          className="w-32 h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50"
          aria-label="Salvar"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(current ?? "");
            setIsEditing(false);
          }}
          className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400"
    >
      {current ?? <span className="text-slate-400 dark:text-slate-500">Definir médico</span>}
      <Pencil className="w-3 h-3 text-slate-300 group-hover:text-emerald-500 dark:text-slate-600" />
    </button>
  );
}

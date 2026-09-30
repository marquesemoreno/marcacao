/** Compartilhado entre inbox-layout.tsx (painel "Perfil & CRM" fixo) e
 * patient-record-sheet.tsx (drawer amplo aberto ao clicar no nome do paciente) — evita
 * tanto duplicar JSX quanto um import circular entre os dois componentes. */
import { SCHEDULED_TAG } from "@/lib/conversation-tags";
import type { ConsultationRecord } from "@/types/chat-crm";

/** O rótulo de cada preset precisa ser IDÊNTICO à string gravada em Conversation.tags
 * (ver conversation-tags.ts) — o filtro da fila faz comparação exata de string
 * (`contact.tags.includes(...)`, ver filteredContacts em inbox-layout.tsx), então
 * qualquer divergência (ex: "Confirmado" vs a tag real "✅ Agendado") faz o filtro nunca
 * bater com nada. */
export const PRESET_TAGS: { label: string; classes: string }[] = [
  { label: "⚡ Prioritário", classes: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  { label: "🔬 Jejum", classes: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  { label: SCHEDULED_TAG, classes: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
  { label: "Urologia", classes: "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800" },
  { label: "Lead B2B", classes: "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800" },
];

export function tagClasses(tag: string) {
  return PRESET_TAGS.find((preset) => preset.label === tag)?.classes ?? "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700";
}

const CONSULTATION_STATUS_BADGE: Record<ConsultationRecord["status"], { label: string; classes: string }> = {
  agendada: { label: "Agendada", classes: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300" },
  confirmada: { label: "Confirmada", classes: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" },
  concluida: { label: "Concluída", classes: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" },
  cancelada: { label: "Cancelada", classes: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" },
  no_show: { label: "Faltou", classes: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300" },
};

/** Uma linha do histórico clínico — função pura, sem estado do componente que a chama. */
export function renderConsultationRow(consultation: ConsultationRecord) {
  const badge = CONSULTATION_STATUS_BADGE[consultation.status];
  return (
    <div
      key={consultation.id}
      className="p-2 rounded-lg border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{consultation.specialty}</span>
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${badge.classes}`}>{badge.label}</span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-0.5 text-slate-500 dark:text-slate-400">
        <span className="truncate">{consultation.date} · {consultation.doctor}</span>
        {consultation.price && (
          <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-300">{consultation.price}</span>
        )}
      </div>
      {consultation.preparationInstructions && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] font-semibold text-sky-700 dark:text-sky-400">
            Ver preparo do exame
          </summary>
          <p className="mt-1 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
            {consultation.preparationInstructions}
          </p>
        </details>
      )}
    </div>
  );
}

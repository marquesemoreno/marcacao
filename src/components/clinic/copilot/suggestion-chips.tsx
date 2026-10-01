"use client";

const SUGGESTIONS = ["Ver horários vagos hoje", "Desmarcar consulta de paciente", "Criar campanha de WhatsApp"];

export function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

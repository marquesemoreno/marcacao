"use client";

import { FileSearch, Stethoscope, ShieldCheck, CalendarClock, Pencil } from "lucide-react";
import type { DocumentReviewData } from "@/lib/documents/document-validator";

const DOCUMENT_TYPE_LABELS: Record<DocumentReviewData["extracted"]["documentType"], string> = {
  PEDIDO_EXAME: "Pedido de Exame",
  RECEITA: "Receita",
  CARTEIRINHA_PLANO: "Carteirinha de Convênio",
  OUTRO: "Documento",
};

const TIER_CLASSES: Record<DocumentReviewData["validation"]["confidence"]["tier"], string> = {
  ALTA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REVISAO: "bg-amber-50 text-amber-700 border-amber-200",
  BAIXA: "bg-rose-50 text-rose-700 border-rose-200",
};

const TIER_LABELS: Record<DocumentReviewData["validation"]["confidence"]["tier"], string> = {
  ALTA: "Alta Confiança",
  REVISAO: "Revisão Necessária",
  BAIXA: "Baixa Confiança",
};

/**
 * Card de revisão do documento médico extraído (ver processMessageDocument em
 * actions/inbox.ts) — renderizado no rodapé do balão de anexo (message-bubble.tsx).
 * "Confirmar e Agendar" pré-seleciona o 1º procedimento com match no catálogo (a
 * ScheduleModal só aceita 1 procedimento por agendamento); "Ajustar Dados" abre o
 * mesmo modal sem pré-seleção, pra recepcionista corrigir pela busca que já existe
 * lá — evita duplicar uma 2ª UI de busca de procedimento dentro do card.
 */
export function DocumentReviewCard({
  data,
  onOpenSchedule,
}: {
  data: DocumentReviewData;
  onOpenSchedule: (clinicProcedureId?: string) => void;
}) {
  const { extracted, validation } = data;
  const firstMatch = validation.procedureMatches.find((m) => m.matched)?.matched ?? null;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-white/10 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
          <FileSearch className="w-3 h-3" />
          {DOCUMENT_TYPE_LABELS[extracted.documentType]}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${TIER_CLASSES[validation.confidence.tier]}`}>
          {TIER_LABELS[validation.confidence.tier]} · {validation.confidence.total}%
        </span>
      </div>

      {validation.procedureMatches.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {validation.procedureMatches.map((match, index) => (
            <span
              key={`${match.rawText}-${index}`}
              title={match.matched ? `${Math.round(match.matched.similarity * 100)}% de similaridade` : "Não reconhecido no catálogo"}
              className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                match.matched
                  ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900"
                  : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
              }`}
            >
              <Stethoscope className="w-3 h-3" />
              {match.matched ? match.matched.procedureName : `"${match.rawText}" (não reconhecido)`}
            </span>
          ))}
        </div>
      )}

      {validation.convenioMatch.identified && (
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium border ${
            validation.convenioMatch.recognizedAsKnown
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          <ShieldCheck className="w-3 h-3" />
          {validation.convenioMatch.identified}
          {!validation.convenioMatch.recognizedAsKnown && " (confirmar)"}
        </span>
      )}

      {(extracted.issuingDoctor || extracted.issueDate) && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <CalendarClock className="w-3 h-3" />
          {[extracted.issuingDoctor, extracted.issueDate].filter(Boolean).join(" · ")}
        </p>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onOpenSchedule(firstMatch?.clinicProcedureId)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
        >
          Confirmar e Agendar
        </button>
        <button
          type="button"
          onClick={() => onOpenSchedule(undefined)}
          className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-semibold transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Ajustar Dados
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, IdCard, MessageCircle, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AvatarBadge } from "@/components/chat/avatar-badge";
import { SLABadge } from "@/components/chat/sla-badge";
import { displayName } from "@/lib/contact-display";
import { formatCurrency, formatPhone } from "@/lib/format";
import { PROCEDURE_INTEREST_TAG_PREFIX } from "@/lib/conversation-tags";
import type { Agent, Contact } from "@/types/chat-crm";

export type KanbanStageOption = { id: string; title: string };

const fmtDate = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso)) : "—";

/** N2 — detalhe do card do CRM. Fecha com X/Esc/clique fora (Dialog do base-ui, que
 * também prende o foco dentro). ← → navegam entre os cards da mesma coluna. */
export function KanbanCardDialog({
  contact,
  currentStage,
  stages,
  agents,
  ticket,
  position,
  onClose,
  onPrev,
  onNext,
  onMove,
  onAssign,
  onOpenChat,
  profileHref,
}: {
  contact: Contact;
  currentStage: string;
  stages: KanbanStageOption[];
  agents: Agent[];
  ticket: number | null;
  position: { index: number; total: number };
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onMove: (stage: string) => void;
  onAssign?: (agentId: string) => void;
  onOpenChat: () => void;
  profileHref?: string;
}) {
  // ← → só quando o foco não está num campo (senão atrapalha usar o <select>).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  const name = displayName(contact);
  const interest = contact.tags.find((t) => t.startsWith(PROCEDURE_INTEREST_TAG_PREFIX))?.slice(PROCEDURE_INTEREST_TAG_PREFIX.length);
  const stageTitle = stages.find((s) => s.id === currentStage)?.title ?? currentStage;
  const isUnassigned = !contact.responsibleAgent || contact.responsibleAgent.toLowerCase() === "não atribuído";
  const agentValue = isUnassigned ? "" : agents.find((a) => a.name === contact.responsibleAgent)?.id ?? "";
  const estimated = contact.estimatedValue ?? (ticket !== null ? `${formatCurrency(ticket)} (ticket médio)` : null);

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100 break-words">{value || "—"}</dd>
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl p-6" showCloseButton={false}>
        <DialogClose
          aria-label="Fechar"
          title="Fechar"
          render={<button className="absolute top-3 right-3 size-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" />}
        >
          <X className="w-5 h-5" />
        </DialogClose>

        <div className="flex items-start gap-3 pr-8">
          <AvatarBadge name={name} photoUrl={contact.avatar} size={48} />
          <div className="min-w-0 space-y-1.5">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</DialogTitle>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800">
                {stageTitle}
              </span>
              {contact.acquisitionChannel && (
                <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  {contact.acquisitionChannel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2">
            Última mensagem · {contact.lastMessageTime || "—"}
            <SLABadge sla={contact.sla} />
          </p>
          <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-4 whitespace-pre-wrap">{contact.lastMessage}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {field("Interesse", interest)}
          {field("Valor estimado", estimated)}
          {field("Telefone", contact.phone ? formatPhone(contact.phone) : contact.instagramUsername ? `@${contact.instagramUsername}` : null)}
          {field("Convênio", contact.convenio)}
          {field("Atendente", isUnassigned ? "Não atribuída" : contact.responsibleAgent)}
          {field("Primeiro contato", fmtDate(contact.firstContactAt))}
        </dl>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            Mover para
            <select
              value={currentStage}
              onChange={(e) => onMove(e.target.value)}
              className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-slate-100"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>
          {onAssign && (
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Atribuir a
              <select
                value={agentValue}
                onChange={(e) => e.target.value && onAssign(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="" disabled>Não atribuída</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white"
            >
              <MessageCircle className="w-4 h-4" /> Responder no chat
            </button>
            {profileHref && (
              <>
                <Link href={profileHref} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <IdCard className="w-4 h-4" /> Ver ficha
                </Link>
                <Link href={`${profileHref}?agendar=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <CalendarPlus className="w-4 h-4" /> Agendar
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Card anterior da coluna" className="size-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {position.index + 1} de {position.total}
            <button type="button" onClick={onNext} disabled={!onNext} aria-label="Próximo card da coluna" className="size-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

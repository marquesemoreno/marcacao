"use client";

import { formatCurrency, formatPhone } from "@/lib/format";
import { KanbanCardDialog } from "@/components/chat/kanban-card-dialog";
import { LostReasonModal } from "@/components/chat/lost-reason-modal";
import { StageMessagePrompt, StageMessageSettings } from "@/components/chat/stage-message-dialogs";
import type { StageMessageStage } from "@/lib/stage-messages";
import { displayName } from "@/lib/contact-display";
import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Agent, Contact, FunnelStage } from '@/types/chat-crm';
import { AvatarBadge } from './avatar-badge';
import {
  columnValue,
  crmAlert,
  kanbanStageOf,
  matchesQuickFilter,
  sortColumn,
  type CrmCardInput,
  type CrmQuickFilter,
  type KanbanStage,
  isNonPatient,
  matchesTags,
  tagCounts,
} from '@/lib/crm-board';
import { NO_RESPONSE_TAG } from '@/lib/conversation-tags';
import { campaignLabel, groupByCampaign } from '@/lib/crm-campaigns';
import {
  Search,
  ArrowRight,
  ArrowLeft,
  UserCheck,
  MessageCircle,
  UserPlus,
  MessagesSquare,
  CircleDollarSign,
  CalendarCheck,
  Flag,
  KanbanSquare,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface CRMKanbanProps {
  contacts: Contact[];
  agents?: Agent[];
  onOpenContactChat?: (contactId: string) => void;
  onMoveStage: (contactId: string, stage: FunnelStage) => void | Promise<void>;
  /** Finaliza com o desfecho escolhido no LostReasonModal (motivo + observação). */
  onFinish: (contactId: string, resolution?: { reason: string; notes?: string }) => void | Promise<void>;
  onReopen: (contactId: string) => void | Promise<void>;
  /** D1: primeira carga em andamento — mostra "Carregando…" em vez de colunas zeradas. */
  isLoading?: boolean;
  /** D1: a carga falhou — aviso com "Tentar de novo" em vez de um quadro vazio silencioso. */
  loadError?: boolean;
  onRetry?: () => void;
  /** N2: ticket médio da clínica — usado no valor da coluna pra quem não tem estimado. */
  ticket?: number | null;
  onAssign?: (contactId: string, agentId: string) => void;
  /** N2: link da ficha do paciente (só no painel da clínica). */
  profileHref?: (contactId: string) => string;
  /** N2: "+ Adicionar" no fim da coluna (cadastra contato já naquela etapa). */
  onAddToStage?: (stage: FunnelStage) => void;
}

const STAGES: { id: KanbanStage; title: string; accent: string }[] = [
  { id: 'novos', title: 'Novos', accent: 'bg-amber-400' },
  { id: 'triagem', title: 'Em atendimento', accent: 'bg-sky-400' },
  { id: 'orcamento', title: 'Orçamento', accent: 'bg-violet-400' },
  { id: 'agendado', title: 'Agendado', accent: 'bg-emerald-500' },
  { id: 'finalizado', title: 'Finalizado', accent: 'bg-slate-400' },
];
const STAGE_TITLE = Object.fromEntries(STAGES.map((s) => [s.id, s.title])) as Record<KanbanStage, string>;

const STAGE_ICONS: Record<KanbanStage, React.ComponentType<{ className?: string }>> = {
  novos: UserPlus,
  triagem: MessagesSquare,
  orcamento: CircleDollarSign,
  agendado: CalendarCheck,
  finalizado: Flag,
};

const STAGE_ORDER: KanbanStage[] = ['novos', 'triagem', 'orcamento', 'agendado', 'finalizado'];

const QUICK_FILTERS: { id: CrmQuickFilter; label: string; hint: string }[] = [
  { id: 'ativos', label: 'Ativos', hint: 'Sem os finalizados' },
  { id: 'aguardando', label: 'Aguardando resposta (>15 min)', hint: 'Paciente escreveu e ninguém respondeu há mais de 15 minutos' },
  { id: 'frios', label: 'Leads frios (>30 dias)', hint: 'Ativos sem conversa há mais de 30 dias' },
  { id: 'todos', label: 'Todos', hint: 'Inclui os finalizados' },
];

const isUnassignedAgent = (name?: string) => !name || name === 'Não Atribuído' || name === 'Não atribuído';

function toBoardInput(c: Contact): CrmCardInput {
  return {
    isResolved: !!c.isResolved,
    funnelStage: c.funnelStage,
    waitingMinutes: c.sla?.shouldDisplay ? c.sla.realWaitingMinutes : null,
    lastMessageAt: c.lastMessageAt,
    tags: c.tags,
    estimatedValueNumber: c.estimatedValueNumber,
  };
}

/** CRM em quadro (crítica + pedido de 15/10/2026): coluna pelo status real (finalizada
 * vai pra Finalizado mesmo com motivo), cards compactos ordenados por quem espera há mais
 * tempo, filtros rápidos (ativos / aguardando >15 min / frios >30 dias), valor estimado
 * por coluna, alerta no card ("Sem retorno" / "sem interação hoje") e, ao finalizar,
 * o desfecho com o motivo da perda. Mover tem aviso com Desfazer. */
export const CRMKanban: React.FC<CRMKanbanProps> = ({
  contacts,
  isLoading = false,
  loadError = false,
  onRetry,
  ticket = null,
  onAssign,
  profileHref,
  onAddToStage,
  agents = [],
  onOpenContactChat,
  onMoveStage,
  onFinish,
  onReopen,
}) => {
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('todos');
  const [quick, setQuick] = useState<CrmQuickFilter>('ativos');
  // Agrupar por etapa (padrão) ou por campanha de origem (pedido de 19/10, ref. Kommo).
  const [groupBy, setGroupBy] = useState<'etapa' | 'campanha'>('etapa');
  const [campaign, setCampaign] = useState<string>('todas');
  // Chips de tag (tipo de serviço/origem) em vez de uma coluna por tag; "Não é paciente"
  // fica escondido até pedir (pedido de 21/10, ref. Kommo da Acurae).
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showNonPatients, setShowNonPatients] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<KanbanStage | null>(null);
  const [finishing, setFinishing] = useState<Contact | null>(null);
  const [stagePrompt, setStagePrompt] = useState<{ conversationId: string; stage: StageMessageStage; patientName: string } | null>(null);
  const draggingRef = useRef<string | null>(null);
  const now = useMemo(() => new Date(), [contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  const stageOf = (c: Contact) => kanbanStageOf(toBoardInput(c));

  async function moveTo(contactId: string, target: KanbanStage, withUndo = true) {
    const current = contacts.find((c) => c.id === contactId);
    if (!current) return;
    const from = stageOf(current);
    if (from === target) return;
    if (target === 'finalizado') {
      setFinishing(current);
      return;
    }
    try {
      if (from === 'finalizado') await onReopen(contactId);
      await onMoveStage(contactId, target as FunnelStage);
    } catch {
      toast.error('Não foi possível mover. Tente de novo.');
      return;
    }
    if (!withUndo) return;
    // Etapas em que a clínica pode ter uma mensagem sugerida (só aparece se houver modelo cadastrado).
    if (target === "orcamento" || target === "agendado") {
      setStagePrompt({ conversationId: contactId, stage: target, patientName: displayName(current) });
    }
    toast.success(`${displayName(current)} → ${STAGE_TITLE[target]}`, {
      action: {
        label: 'Desfazer',
        onClick: () => {
          if (from === 'finalizado') toast.message('Para voltar a Finalizado, mova o card de novo e escolha o desfecho.');
          else moveTo(contactId, from, false);
        },
      },
    });
  }

  function moveDirection(contactId: string, direction: 1 | -1) {
    const current = contacts.find((c) => c.id === contactId);
    if (!current) return;
    const idx = STAGE_ORDER.indexOf(stageOf(current));
    const next = STAGE_ORDER[Math.min(STAGE_ORDER.length - 1, Math.max(0, idx + direction))];
    moveTo(contactId, next);
  }

  const filtered = useMemo(
    () =>
      contacts.filter((c) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q || c.name.toLowerCase().includes(q) || c.phone.includes(search.trim()) || c.tags.some((t) => t.toLowerCase().includes(q));
        const matchesAgent =
          selectedAgent === 'todos' || (selectedAgent === 'unassigned' ? isUnassignedAgent(c.responsibleAgent) : c.responsibleAgent === selectedAgent);
        const matchesCampaign = campaign === 'todas' || campaignLabel(c.acquisitionChannel, c.acquisitionDetail) === campaign;
        const patientOk = showNonPatients || !isNonPatient(c.tags);
        return (
          patientOk &&
          matchesSearch &&
          matchesAgent &&
          matchesCampaign &&
          matchesTags(c, selectedTags) &&
          matchesQuickFilter(toBoardInput(c), quick, now)
        );
      }),
    [contacts, search, selectedAgent, campaign, selectedTags, showNonPatients, quick, now]
  );

  const columns = useMemo(
    () =>
      STAGES.filter((s) => quick === 'todos' || s.id !== 'finalizado').map((stage) => {
        const cards = sortColumn(filtered.filter((c) => stageOf(c) === stage.id).map((c) => Object.assign(toBoardInput(c), { contact: c })));
        return { stage, cards, value: columnValue(cards, ticket) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, quick, ticket]
  );

  const tagChips = useMemo(() => tagCounts(contacts.filter((c) => !isNonPatient(c.tags))), [contacts]);
  const nonPatientCount = useMemo(() => contacts.filter((c) => isNonPatient(c.tags)).length, [contacts]);
  const campaignOptions = useMemo(() => groupByCampaign(contacts).map((col) => col.label), [contacts]);
  const campaignColumns = useMemo(() => groupByCampaign(filtered), [filtered]);

  const openCard = openCardId ? contacts.find((c) => c.id === openCardId) ?? null : null;
  const openColumn = openCard ? columns.find((col) => col.stage.id === stageOf(openCard))?.cards.map((x) => x.contact) ?? [] : [];
  const openIndex = openCard ? openColumn.findIndex((c) => c.id === openCard.id) : -1;
  const hasActiveFilter = search.trim() !== '' || selectedAgent !== 'todos' || quick !== 'ativos' || campaign !== 'todas' || selectedTags.length > 0;
  const finalizedCount = contacts.filter((c) => c.isResolved).length;
  // Primeira carga: não mostra "0 pacientes" nem colunas vazias como se fosse o resultado.
  const loadingEmpty = isLoading && contacts.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-100/90 dark:bg-slate-950/90 overflow-hidden text-slate-900 dark:text-slate-100" data-od-id="crm-kanban-view">
      {/* Barra superior */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 space-y-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <KanbanSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            CRM
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400 tabular-nums">
              {loadingEmpty ? 'carregando…' : `${filtered.length} paciente${filtered.length === 1 ? '' : 's'}`}
            </span>
          </h2>
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden />
            <input
              type="text"
              aria-label="Buscar no CRM"
              placeholder="Buscar paciente, telefone ou tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div className="relative w-full sm:w-48 flex items-center">
            <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" aria-hidden />
            <select
              aria-label="Filtrar por atendente"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="todos">Todas as atendentes</option>
              <option value="unassigned">Sem dono</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.name}>
                  {ag.name}
                </option>
              ))}
            </select>
          </div>
          <select
            aria-label="Filtrar por campanha"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="w-full sm:w-56 h-9 px-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="todas">Todas as campanhas</option>
            {campaignOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <div role="radiogroup" aria-label="Agrupar colunas por" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
            {(['etapa', 'campanha'] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={groupBy === g}
                onClick={() => setGroupBy(g)}
                className={`h-8 px-3 rounded-md text-sm font-medium ${
                  groupBy === g ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {g === 'etapa' ? 'Por etapa' : 'Por campanha'}
              </button>
            ))}
          </div>
          <StageMessageSettings />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedAgent('todos');
                setQuick('ativos');
                setCampaign('todas');
                setSelectedTags([]);
              }}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 underline underline-offset-2"
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Filtro rápido" className="flex flex-wrap gap-1.5">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={quick === f.id}
              title={f.hint}
              onClick={() => setQuick(f.id)}
              className={`h-8 px-3 rounded-md text-sm font-medium border focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                quick === f.id
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
              {f.id === 'todos' && finalizedCount > 0 && <span className="ml-1 text-xs opacity-70 tabular-nums">(+{finalizedCount} finalizados)</span>}
            </button>
          ))}
        </div>
        {(tagChips.length > 0 || nonPatientCount > 0) && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtrar por tag">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tags:</span>
            {(showAllTags ? tagChips : tagChips.slice(0, 10)).map(({ tag, count }) => {
              const on = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedTags((prev) => (on ? prev.filter((t) => t !== tag) : [...prev, tag]))}
                  className={`h-7 rounded-full border px-2.5 text-xs font-medium ${
                    on
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {tag} <span className="tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
            {tagChips.length > 10 && (
              <button type="button" onClick={() => setShowAllTags((v) => !v)} className="h-7 px-2 text-xs font-medium text-slate-600 dark:text-slate-300 underline underline-offset-2">
                {showAllTags ? 'menos' : `+${tagChips.length - 10} tags`}
              </button>
            )}
            {nonPatientCount > 0 && (
              <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <input type="checkbox" checked={showNonPatients} onChange={(e) => setShowNonPatients(e.target.checked)} className="size-3.5 accent-emerald-600" />
                Mostrar não pacientes ({nonPatientCount})
              </label>
            )}
          </div>
        )}
      </div>

      {(isLoading || loadError) && (
        <div
          role={loadError ? 'alert' : 'status'}
          className={`mx-4 sm:mx-6 mt-3 rounded-lg border px-4 py-3 text-sm flex items-center justify-between gap-3 ${
            loadError
              ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
          }`}
        >
          {loadError ? 'Não foi possível carregar os pacientes do CRM.' : 'Carregando pacientes…'}
          {loadError && onRetry && (
            <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
              Tentar de novo
            </button>
          )}
        </div>
      )}

      {groupBy === 'campanha' && (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-3 sm:p-4">
          <div className="grid h-full min-h-0 grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3">
            {campaignColumns.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum paciente com esses filtros.</p>
            )}
            {campaignColumns.map((col) => {
              const scheduled = col.items.filter((c) => stageOf(c) === 'agendado').length;
              const value = columnValue(col.items.map(toBoardInput), ticket);
              return (
                <section
                  key={col.label}
                  aria-label={`${col.label}: ${col.items.length} paciente${col.items.length === 1 ? '' : 's'}`}
                  className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/60"
                >
                  <header className="shrink-0 rounded-t-lg border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 truncate text-sm font-semibold" title={col.label}>{col.label}</h3>
                      <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">{col.items.length}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {scheduled} agendado{scheduled === 1 ? '' : 's'}
                      {value.total > 0 ? ` · ${formatCurrency(value.total)} estimado` : ''}
                    </p>
                  </header>
                  <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
                    {sortColumn(col.items.map((c) => Object.assign(toBoardInput(c), { contact: c }))).map(({ contact, estimatedValueNumber }) => {
                      const name = displayName(contact);
                      const st = stageOf(contact);
                      return (
                        <article key={contact.id} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-xs">
                          <button
                            type="button"
                            onClick={() => setOpenCardId(contact.id)}
                            className="flex w-full items-center gap-2 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                            aria-label={`Abrir ${name}`}
                          >
                            <AvatarBadge name={name} photoUrl={contact.avatar} size={28} className="shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{name}</span>
                              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                {isUnassignedAgent(contact.responsibleAgent) ? 'Sem dono' : contact.responsibleAgent.split(' ')[0]}
                              </span>
                            </span>
                            {estimatedValueNumber ? (
                              <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrency(estimatedValueNumber)}</span>
                            ) : null}
                          </button>
                          <div className="mt-1.5 flex items-center justify-between gap-1">
                            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                              {st === 'finalizado' ? contact.statusTag.label : STAGE_TITLE[st]}
                            </span>
                            {onOpenContactChat && (
                              <button
                                type="button"
                                onClick={() => onOpenContactChat(contact.id)}
                                aria-label={`Abrir conversa com ${name}`}
                                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                              >
                                <MessageCircle className="w-3.5 h-3.5" aria-hidden /> Chat
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* Quadro: só ele rola na horizontal; cada coluna rola por dentro na vertical. */}
      <div className={`flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-3 sm:p-4 ${groupBy === 'campanha' ? 'hidden' : ''}`}>
        <div className="grid h-full min-h-0 grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3">
          {columns.map(({ stage, cards, value }) => {
            const Icon = STAGE_ICONS[stage.id];
            return (
              <section
                key={stage.id}
                aria-label={loadingEmpty ? `${stage.title}: carregando` : `${stage.title}: ${cards.length} paciente${cards.length === 1 ? '' : 's'}`}
                aria-busy={loadingEmpty}
                className={`flex h-full min-h-0 flex-col rounded-lg border bg-slate-50/90 dark:bg-slate-900/60 ${
                  dragOverStage === stage.id ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-slate-200 dark:border-slate-800'
                }`}
                onDragOver={(e) => {
                  if (!draggingRef.current) return;
                  e.preventDefault();
                  if (dragOverStage !== stage.id) setDragOverStage(stage.id);
                }}
                onDragLeave={() => setDragOverStage((cur) => (cur === stage.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = draggingRef.current;
                  setDragOverStage(null);
                  if (id) moveTo(id, stage.id);
                }}
              >
                <header className="shrink-0 rounded-t-lg border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${stage.accent}`} aria-hidden />
                    <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden />
                    <h3 className="text-sm font-semibold">{stage.title}</h3>
                    <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">{loadingEmpty ? '–' : cards.length}</span>
                  </div>
                  {value.total > 0 && stage.id !== 'finalizado' && (
                    <p
                      className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums"
                      title={value.fromTicket ? `${value.fromTicket} sem valor estimado — contados pelo ticket médio da clínica` : 'Soma do valor estimado dos cards'}
                    >
                      {formatCurrency(value.total)} estimado{value.fromTicket ? ' *' : ''}
                    </p>
                  )}
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
                  {loadingEmpty ? (
                    <div aria-hidden className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-16 animate-pulse rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60" />
                      ))}
                    </div>
                  ) : cards.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      Nenhum paciente aqui
                    </p>
                  ) : (
                    cards.map(({ contact, waitingMinutes, estimatedValueNumber }) => {
                      const name = displayName(contact);
                      const alert = crmAlert(toBoardInput(contact), now);
                      const unassigned = isUnassignedAgent(contact.responsibleAgent);
                      const stageIdx = STAGE_ORDER.indexOf(stage.id);
                      const extraTags = contact.tags.filter((t) => t !== NO_RESPONSE_TAG);
                      return (
                        <article
                          key={contact.id}
                          draggable
                          onDragStart={(e) => {
                            draggingRef.current = contact.id;
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            draggingRef.current = null;
                            setDragOverStage(null);
                          }}
                          className={`group rounded-lg border bg-white dark:bg-slate-900 p-2.5 shadow-xs transition-colors ${
                            alert === 'sem_retorno'
                              ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenCardId(contact.id)}
                            className="flex w-full items-center gap-2 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                            aria-label={`Abrir ${name}`}
                          >
                            <AvatarBadge name={name} photoUrl={contact.avatar} size={28} className="shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold" title={name}>
                                {name}
                              </span>
                              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                {contact.phone ? formatPhone(contact.phone) : 'Sem telefone'} ·{' '}
                                <span className={unassigned ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}>
                                  {unassigned ? 'Sem dono' : contact.responsibleAgent.split(' ')[0]}
                                </span>
                              </span>
                            </span>
                            {estimatedValueNumber ? (
                              <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrency(estimatedValueNumber)}</span>
                            ) : null}
                          </button>

                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {waitingMinutes !== null && waitingMinutes > 0 ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                                  waitingMinutes > 60
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                    : waitingMinutes > 15
                                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                <Clock className="w-3 h-3" aria-hidden /> aguarda há {contact.sla.formattedTime}
                              </span>
                            ) : (
                              <span className="truncate text-xs text-slate-500 dark:text-slate-400 max-w-full" title={contact.lastMessage}>
                                {contact.lastMessageTime ? `${contact.lastMessageTime} · ` : ''}
                                {contact.lastMessage}
                              </span>
                            )}
                            {alert === 'sem_retorno' && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="w-3 h-3" aria-hidden /> Sem retorno
                              </span>
                            )}
                            {alert === 'sem_interacao_hoje' && waitingMinutes === null && (
                              <span className="rounded-md border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">sem interação hoje</span>
                            )}
                            {stage.id === 'finalizado' && (
                              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">{contact.statusTag.label}</span>
                            )}
                            {extraTags.slice(0, 2).map((tag) => (
                              <span key={tag} className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                                {tag}
                              </span>
                            ))}
                            {extraTags.length > 2 && <span className="text-xs text-slate-500">+{extraTags.length - 2}</span>}
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                disabled={stageIdx === 0}
                                onClick={() => moveDirection(contact.id, -1)}
                                aria-label={`Voltar ${name} para ${STAGE_TITLE[STAGE_ORDER[Math.max(0, stageIdx - 1)]]}`}
                                title="Voltar etapa"
                                className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-30"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                disabled={stageIdx === STAGE_ORDER.length - 1}
                                onClick={() => moveDirection(contact.id, 1)}
                                aria-label={`Avançar ${name} para ${STAGE_TITLE[STAGE_ORDER[Math.min(STAGE_ORDER.length - 1, stageIdx + 1)]]}`}
                                title="Avançar etapa"
                                className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400 disabled:opacity-30"
                              >
                                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                              </button>
                            </div>
                            {onOpenContactChat && (
                              <button
                                type="button"
                                onClick={() => onOpenContactChat(contact.id)}
                                aria-label={`Abrir conversa com ${name}`}
                                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                              >
                                <MessageCircle className="w-3.5 h-3.5" aria-hidden /> Chat
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                  {onAddToStage && stage.id !== 'finalizado' && (
                    <button
                      type="button"
                      onClick={() => onAddToStage(stage.id as FunnelStage)}
                      className="w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {openCard && (
        <KanbanCardDialog
          contact={openCard}
          currentStage={stageOf(openCard)}
          stages={STAGES.map((st) => ({ id: st.id, title: st.title }))}
          agents={agents}
          ticket={ticket}
          position={{ index: Math.max(0, openIndex), total: openColumn.length }}
          onClose={() => setOpenCardId(null)}
          onPrev={openIndex > 0 ? () => setOpenCardId(openColumn[openIndex - 1].id) : undefined}
          onNext={openIndex >= 0 && openIndex < openColumn.length - 1 ? () => setOpenCardId(openColumn[openIndex + 1].id) : undefined}
          onMove={(stage) => moveTo(openCard.id, stage as KanbanStage)}
          onAssign={onAssign ? (agentId) => onAssign(openCard.id, agentId) : undefined}
          onOpenChat={() => onOpenContactChat?.(openCard.id)}
          profileHref={profileHref?.(openCard.id)}
        />
      )}

      <StageMessagePrompt target={stagePrompt} onClose={() => setStagePrompt(null)} />
      <LostReasonModal
        open={!!finishing}
        patientName={finishing ? displayName(finishing) : ''}
        onCancel={() => setFinishing(null)}
        onConfirm={async (resolution) => {
          if (!finishing) return;
          try {
            await onFinish(finishing.id, resolution);
            toast.success(`${displayName(finishing)} finalizado.`);
            setFinishing(null);
          } catch {
            toast.error('Não foi possível finalizar. Tente de novo.');
          }
        }}
      />
    </div>
  );
};

"use client";

import { formatCurrency, formatPhone } from "@/lib/format";
import { KanbanCardDialog } from "@/components/chat/kanban-card-dialog";
import { displayName } from "@/lib/contact-display";
import React, { useRef, useState } from 'react';
import { Agent, Contact, FunnelStage } from '@/types/chat-crm';
import { AvatarBadge } from './avatar-badge';
import {
  Search,
  Phone,
  ArrowRight,
  ArrowLeft,
  Filter,
  UserCheck,
  Building2,
  ExternalLink,
  UserPlus,
  MessagesSquare,
  CircleDollarSign,
  CalendarCheck,
  Flag,
  KanbanSquare,
} from 'lucide-react';

type KanbanStage = FunnelStage | 'finalizado';

interface CRMKanbanProps {
  contacts: Contact[];
  agents?: Agent[];
  onOpenContactChat?: (contactId: string) => void;
  onMoveStage: (contactId: string, stage: FunnelStage) => void;
  onFinish: (contactId: string) => void;
  onReopen: (contactId: string) => void;
  /** D1: primeira carga em andamento — mostra "Carregando…" em vez de colunas zeradas. */
  isLoading?: boolean;
  /** D1: a carga falhou — aviso com "Tentar de novo" em vez de um quadro vazio silencioso. */
  loadError?: boolean;
  onRetry?: () => void;
  /** N2: ticket médio da clínica — soma em R$ por coluna. null = não configurado. */
  ticket?: number | null;
  onAssign?: (contactId: string, agentId: string) => void;
  /** N2: link da ficha do paciente (só no painel da clínica). */
  profileHref?: (contactId: string) => string;
  /** N2: "+ Adicionar" no fim da coluna (cadastra contato já naquela etapa). */
  onAddToStage?: (stage: FunnelStage) => void;
}

const STAGES: { id: KanbanStage; title: string; shortLabel: string; color: string; bgBadge: string }[] = [
  { id: 'novos', title: 'Novos pacientes', shortLabel: 'Novos', color: 'border-amber-400', bgBadge: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { id: 'triagem', title: 'Em atendimento', shortLabel: 'Em atendimento', color: 'border-sky-400', bgBadge: 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  { id: 'orcamento', title: 'Orçamento / dúvidas', shortLabel: 'Orçamento', color: 'border-purple-400', bgBadge: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { id: 'agendado', title: 'Agendamento confirmado', shortLabel: 'Agendado', color: 'border-emerald-500', bgBadge: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { id: 'finalizado', title: 'Finalizado / realizado', shortLabel: 'Finalizado', color: 'border-slate-400', bgBadge: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
];

/** Ícones de linha no lugar dos emojis dos títulos (mesma família do menu lateral). */
const STAGE_ICONS: Record<KanbanStage, React.ComponentType<{ className?: string }>> = {
  novos: UserPlus,
  triagem: MessagesSquare,
  orcamento: CircleDollarSign,
  agendado: CalendarCheck,
  finalizado: Flag,
};

const STAGE_ORDER: KanbanStage[] = ['novos', 'triagem', 'orcamento', 'agendado', 'finalizado'];

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
  const [selectedDept, setSelectedDept] = useState<string>('todos');
  const [mobileSelectedStage, setMobileSelectedStage] = useState<KanbanStage | 'todos'>('todos');
  // N2: card aberto no modal + proteção "arrastou, não abre" (o click dispara logo
  // depois do drop no mesmo elemento).
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<KanbanStage | null>(null);
  const draggingRef = useRef<string | null>(null);
  const justDraggedRef = useRef(false);

  const moveStage = (contactId: string, targetStage: KanbanStage) => {
    const current = contacts.find((c) => c.id === contactId);
    if (!current) return;
    const isCurrentFinalized = current.statusTag.label === 'Finalizado';

    if (targetStage === 'finalizado') {
      onFinish(contactId);
    } else if (isCurrentFinalized) {
      onReopen(contactId);
      onMoveStage(contactId, targetStage as FunnelStage);
    } else {
      onMoveStage(contactId, targetStage as FunnelStage);
    }
  };

  const moveStageDirection = (contactId: string, direction: 'forward' | 'backward') => {
    const current = contacts.find((c) => c.id === contactId);
    if (!current) return;
    const currentStage = current.statusTag.label === 'Finalizado' ? 'finalizado' : current.funnelStage;
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    let nextIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= STAGE_ORDER.length) nextIndex = STAGE_ORDER.length - 1;
    moveStage(contactId, STAGE_ORDER[nextIndex]);
  };

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesAgent =
      selectedAgent === 'todos' ||
      (selectedAgent === 'unassigned'
        ? !c.responsibleAgent || c.responsibleAgent === 'Não Atribuído' || c.responsibleAgent === 'Não atribuído'
        : c.responsibleAgent === selectedAgent);

    const matchesDept =
      selectedDept === 'todos' || c.department === selectedDept;

    return matchesSearch && matchesAgent && matchesDept;
  });

  const stageOf = (c: Contact) => (c.statusTag.label === 'Finalizado' ? 'finalizado' : c.funnelStage);
  const openCard = openCardId ? contacts.find((c) => c.id === openCardId) ?? null : null;
  const openColumn = openCard ? filtered.filter((c) => stageOf(c) === stageOf(openCard)) : [];
  const openIndex = openCard ? openColumn.findIndex((c) => c.id === openCard.id) : -1;

  const hasActiveFilter =
    search.trim() !== '' || selectedAgent !== 'todos' || selectedDept !== 'todos' || mobileSelectedStage !== 'todos';

  const visibleStages = mobileSelectedStage === 'todos'
    ? STAGES
    : STAGES.filter((s) => s.id === mobileSelectedStage);

  return (
    <div
      className="flex-1 flex flex-col h-full bg-slate-100/90 dark:bg-slate-950/90 overflow-hidden font-sans text-slate-900 dark:text-slate-100"
      data-od-id="crm-kanban-view"
    >
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <KanbanSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>CRM</span>
            <span className="text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {filtered.length} paciente{filtered.length === 1 ? '' : 's'}
            </span>
          </h2>

          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar paciente, fone ou tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="relative w-full sm:w-44 flex items-center">
            <UserCheck className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-700 dark:text-slate-200 appearance-none cursor-pointer"
            >
              <option value="todos">Todos os atendentes</option>
              <option value="unassigned">Não atribuídos</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.name}>
                  {ag.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-44 flex items-center">
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-700 dark:text-slate-200 appearance-none cursor-pointer"
            >
              <option value="todos">Todos os departamentos</option>
              <option value="recepcao">Recepção</option>
              <option value="agendamento">Agendamento</option>
              <option value="financeiro">Financeiro</option>
            </select>
          </div>

          {hasActiveFilter && (
            <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1">
              Filtro ativo
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedAgent('todos');
                  setSelectedDept('todos');
                  setMobileSelectedStage('todos');
                }}
                className="font-semibold underline underline-offset-2"
              >
                Limpar
              </button>
            </span>
          )}
        </div>

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

      <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-xs font-mono text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1 shrink-0">
          <Filter className="w-3 h-3" /> Etapa:
        </span>
        <button
          onClick={() => setMobileSelectedStage('todos')}
          className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all shrink-0 ${
            mobileSelectedStage === 'todos'
              ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          Todas ({filtered.length})
        </button>
        {STAGES.map((s) => {
          const count = filtered.filter((c) => (c.statusTag.label === 'Finalizado' ? 'finalizado' : c.funnelStage) === s.id).length;
          const isActive = mobileSelectedStage === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setMobileSelectedStage(s.id)}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>{s.shortLabel}</span>
              <span className="text-xs opacity-80 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-x-auto p-3 sm:p-5">
        <div className={`flex gap-4 sm:gap-5 h-full ${mobileSelectedStage === 'todos' ? 'min-w-full sm:min-w-[1400px]' : 'w-full'}`}>
          {visibleStages.map((stage) => {
            const stageContacts = filtered.filter((c) => {
              const currentStage = c.statusTag.label === 'Finalizado' ? 'finalizado' : c.funnelStage;
              return currentStage === stage.id;
            });
            return (
              <div
                key={stage.id}
                className={`flex-1 flex flex-col bg-slate-50/90 dark:bg-slate-900/60 rounded-lg border overflow-hidden shadow-xs min-w-[280px] sm:min-w-0 ${
                  dragOverStage === stage.id ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-slate-200/90 dark:border-slate-800'
                }`}
                data-od-id={`kanban-column-${stage.id}`}
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
                  if (!id) return;
                  const current = contacts.find((c) => c.id === id);
                  const currentStage = current ? (current.statusTag.label === 'Finalizado' ? 'finalizado' : current.funnelStage) : null;
                  if (currentStage !== stage.id) moveStage(id, stage.id);
                }}
              >
                <div className={`p-3 bg-white dark:bg-slate-900 border-t-4 ${stage.color} border-b border-slate-200 dark:border-slate-800 flex items-center justify-between`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">
                        {(() => {
                          const Icon = STAGE_ICONS[stage.id];
                          return <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
                        })()}
                        {stage.title}
                      </h3>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full font-mono border ${stage.bgBadge}`}>
                        {stageContacts.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {stageContacts.length} paciente{stageContacts.length === 1 ? '' : 's'}
                      {ticket !== null && stageContacts.length > 0 && (
                        <span title="Quantidade × ticket médio da clínica"> · {formatCurrency(stageContacts.length * ticket)}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-3">
                  {stageContacts.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400 font-medium">
                      Nenhum paciente nesta etapa
                    </div>
                  ) : (
                    stageContacts.map((contact) => {
                      const isUnassigned = !contact.responsibleAgent || contact.responsibleAgent === 'Não Atribuído' || contact.responsibleAgent === 'Não atribuído';

                      return (
                        <div
                          key={contact.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Abrir detalhes de ${displayName(contact)}`}
                          draggable
                          onDragStart={(e) => {
                            draggingRef.current = contact.id;
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            draggingRef.current = null;
                            setDragOverStage(null);
                            justDraggedRef.current = true;
                            setTimeout(() => (justDraggedRef.current = false), 250);
                          }}
                          onClick={() => {
                            if (justDraggedRef.current) return;
                            setOpenCardId(contact.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target === e.currentTarget) setOpenCardId(contact.id);
                          }}
                          className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 space-y-3 group relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          data-od-id={`kanban-card-${contact.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <AvatarBadge name={displayName(contact)} photoUrl={contact.avatar} size={36} className="ring-2 ring-slate-100 dark:ring-slate-800 shrink-0" />
                              <div className="min-w-0">
                                <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                  {displayName(contact)}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> {formatPhone(contact.phone)}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium border ${
                                isUnassigned
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                              title={isUnassigned ? "Nenhum atendente assumiu esta conversa" : `Atribuído a ${contact.responsibleAgent}`}
                            >
                              {isUnassigned ? "Não atribuída" : contact.responsibleAgent}
                            </span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg space-y-1 border border-slate-100 dark:border-slate-800">
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed italic">
                              &ldquo;{contact.lastMessage}&rdquo;
                            </p>
                            {contact.lastMessageTime && (
                              <p className="text-xs text-slate-400 font-mono font-medium">{contact.lastMessageTime}</p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1">
                              {contact.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                                >
                                  {tag}
                                </span>
                              ))}
                              {contact.statusTag && (
                                <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {contact.statusTag.label}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                              <span className="text-xs text-slate-400 font-medium">Estimado:</span>
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {contact.estimatedValue || '—'}
                              </span>
                            </div>
                          </div>

                          <div
                            className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              {stage.id !== 'novos' && (
                                <button
                                  onClick={() => moveStageDirection(contact.id, 'backward')}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Voltar etapa"
                                >
                                  <ArrowLeft className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <select
                                value={contact.statusTag.label === 'Finalizado' ? 'finalizado' : contact.funnelStage}
                                onChange={(e) => moveStage(contact.id, e.target.value as KanbanStage)}
                                className="text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-1.5 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              >
                                {STAGES.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.shortLabel}
                                  </option>
                                ))}
                              </select>

                              {stage.id !== 'finalizado' && (
                                <button
                                  onClick={() => moveStageDirection(contact.id, 'forward')}
                                  className="p-1.5 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                                  title="Avançar etapa"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {onOpenContactChat && (
                              <button
                                onClick={() => onOpenContactChat(contact.id)}
                                className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center gap-1 hover:underline py-1 px-2.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100/80 rounded-lg transition-all border border-emerald-200/60 dark:border-emerald-800 shadow-xs"
                                title="Abrir conversa na Caixa de Entrada"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Chat</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {onAddToStage && stage.id !== 'finalizado' && (
                    <button
                      type="button"
                      onClick={() => onAddToStage(stage.id as FunnelStage)}
                      className="w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>
              </div>
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
          onMove={(stage) => moveStage(openCard.id, stage as KanbanStage)}
          onAssign={onAssign ? (agentId) => onAssign(openCard.id, agentId) : undefined}
          onOpenChat={() => onOpenContactChat?.(openCard.id)}
          profileHref={profileHref?.(openCard.id)}
        />
      )}
    </div>
  );
};

"use client";

import React, { useState } from 'react';
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
} from 'lucide-react';

type KanbanStage = FunnelStage | 'finalizado';

interface CRMKanbanProps {
  contacts: Contact[];
  agents?: Agent[];
  onOpenContactChat?: (contactId: string) => void;
  onMoveStage: (contactId: string, stage: FunnelStage) => void;
  onFinish: (contactId: string) => void;
  onReopen: (contactId: string) => void;
}

const STAGES: { id: KanbanStage; title: string; shortLabel: string; color: string; bgBadge: string }[] = [
  { id: 'novos', title: '🆕 Novos Pacientes', shortLabel: '🆕 Novos', color: 'border-amber-400', bgBadge: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { id: 'triagem', title: '💬 Em Atendimento', shortLabel: '💬 Em Atendimento', color: 'border-sky-400', bgBadge: 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  { id: 'orcamento', title: '💲 Orçamento / Dúvidas', shortLabel: '💲 Orçamento', color: 'border-purple-400', bgBadge: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { id: 'agendado', title: '🎟️ Agendamento Confirmado', shortLabel: '🎟️ Agendado', color: 'border-emerald-500', bgBadge: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { id: 'finalizado', title: '🏁 Finalizado / Realizado', shortLabel: '🏁 Finalizado', color: 'border-slate-400', bgBadge: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
];

const STAGE_ORDER: KanbanStage[] = ['novos', 'triagem', 'orcamento', 'agendado', 'finalizado'];

export const CRMKanban: React.FC<CRMKanbanProps> = ({
  contacts,
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
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>📋 CRM</span>
            <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
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
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="relative w-full sm:w-44 flex items-center">
            <UserCheck className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-700 dark:text-slate-200 appearance-none cursor-pointer"
            >
              <option value="todos">👤 Todos Atendentes</option>
              <option value="unassigned">⏳ Não Atribuídos</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.name}>
                  👤 {ag.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-44 flex items-center">
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-700 dark:text-slate-200 appearance-none cursor-pointer"
            >
              <option value="todos">🏥 Todos Deptos</option>
              <option value="recepcao">Recepção</option>
              <option value="agendamento">Agendamento</option>
              <option value="financeiro">Financeiro</option>
            </select>
          </div>
        </div>

      </div>

      <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1 shrink-0">
          <Filter className="w-3 h-3" /> Etapa:
        </span>
        <button
          onClick={() => setMobileSelectedStage('todos')}
          className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all shrink-0 ${
            mobileSelectedStage === 'todos'
              ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-2xs'
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
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>{s.shortLabel}</span>
              <span className="text-[10px] opacity-80 font-mono">({count})</span>
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
                className="flex-1 flex flex-col bg-slate-50/90 dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-2xs min-w-[280px] sm:min-w-0"
                data-od-id={`kanban-column-${stage.id}`}
              >
                <div className={`p-3 bg-white dark:bg-slate-900 border-t-4 ${stage.color} border-b border-slate-200 dark:border-slate-800 flex items-center justify-between`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">{stage.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono border ${stage.bgBadge}`}>
                        {stageContacts.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 font-semibold">
                      {stageContacts.length} paciente{stageContacts.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-3">
                  {stageContacts.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-400 font-medium">
                      Nenhum paciente nesta etapa
                    </div>
                  ) : (
                    stageContacts.map((contact) => {
                      const isUnassigned = !contact.responsibleAgent || contact.responsibleAgent === 'Não Atribuído' || contact.responsibleAgent === 'Não atribuído';

                      return (
                        <div
                          key={contact.id}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 space-y-3 group relative"
                          data-od-id={`kanban-card-${contact.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <AvatarBadge name={contact.name} photoUrl={contact.avatar} size={36} className="ring-2 ring-slate-100 dark:ring-slate-800 shrink-0" />
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                  {contact.name}
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> {contact.phone}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold border ${
                                isUnassigned
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                              title={isUnassigned ? "Nenhum atendente assumiu esta conversa" : `Atribuído a ${contact.responsibleAgent}`}
                            >
                              {isUnassigned ? "⏳ Livre" : `👤 ${contact.responsibleAgent}`}
                            </span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl space-y-1 border border-slate-100 dark:border-slate-800">
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed italic">
                              &ldquo;{contact.lastMessage}&rdquo;
                            </p>
                            {contact.lastMessageTime && (
                              <p className="text-[10px] text-slate-400 font-mono font-medium">{contact.lastMessageTime}</p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1">
                              {contact.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                                >
                                  {tag}
                                </span>
                              ))}
                              {contact.statusTag && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {contact.statusTag.label}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                              <span className="text-[11px] text-slate-400 font-medium">Estimado:</span>
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {contact.estimatedValue || '—'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-1.5">
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
                                className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-1.5 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center gap-1 hover:underline py-1 px-2.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100/80 rounded-xl transition-all border border-emerald-200/60 dark:border-emerald-800 shadow-2xs"
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

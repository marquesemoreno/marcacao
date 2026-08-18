"use client";

import React, { useState } from 'react';
import { Contact, FunnelStage } from '@/types/chat-crm';
import { AvatarBadge } from './avatar-badge';
import {
  Search,
  Phone,
  ArrowRight,
  ArrowLeft,
  Filter,
} from 'lucide-react';

type KanbanStage = FunnelStage | 'finalizado';

interface CRMKanbanProps {
  contacts: Contact[];
  onOpenContactChat?: (contactId: string) => void;
  onMoveStage: (contactId: string, stage: FunnelStage) => void;
  onFinish: (contactId: string) => void;
  onReopen: (contactId: string) => void;
}

const STAGES: { id: KanbanStage; title: string; shortLabel: string; color: string; bgBadge: string }[] = [
  { id: 'novos', title: '🆕 Novos Contatos', shortLabel: '🆕 Novos', color: 'border-amber-400', bgBadge: 'bg-amber-100 text-amber-800' },
  { id: 'triagem', title: '💬 Em Atendimento', shortLabel: '💬 Em Atendimento', color: 'border-blue-400', bgBadge: 'bg-blue-100 text-blue-800' },
  { id: 'orcamento', title: '💲 Orçamento Enviado', shortLabel: '💲 Orçamento', color: 'border-purple-400', bgBadge: 'bg-purple-100 text-purple-800' },
  { id: 'agendado', title: '✅ Agendamento Confirmado', shortLabel: '✅ Agendado', color: 'border-emerald-500', bgBadge: 'bg-emerald-100 text-emerald-800' },
  { id: 'finalizado', title: '🏁 Finalizado', shortLabel: '🏁 Finalizado', color: 'border-slate-400', bgBadge: 'bg-slate-200 text-slate-700' },
];

const STAGE_ORDER: KanbanStage[] = ['novos', 'triagem', 'orcamento', 'agendado', 'finalizado'];

function kanbanStageOf(contact: Contact): KanbanStage {
  return contact.statusTag.label === 'Finalizado' ? 'finalizado' : contact.funnelStage;
}

function parseEstimatedValue(value?: string) {
  if (!value) return 0;
  return parseFloat(value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

export const CRMKanban: React.FC<CRMKanbanProps> = ({
  contacts,
  onOpenContactChat,
  onMoveStage,
  onFinish,
  onReopen,
}) => {
  const [search, setSearch] = useState('');
  const [mobileSelectedStage, setMobileSelectedStage] = useState<KanbanStage | 'todos'>('todos');

  const moveStage = (contactId: string, direction: 'forward' | 'backward') => {
    const current = contacts.find((c) => c.id === contactId);
    if (!current) return;
    const wasFinalizado: boolean = kanbanStageOf(current) === 'finalizado';
    const currentIndex = STAGE_ORDER.indexOf(kanbanStageOf(current));
    let nextIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= STAGE_ORDER.length) nextIndex = STAGE_ORDER.length - 1;
    const nextStage = STAGE_ORDER[nextIndex];
    const willBeFinalizado: boolean = nextStage === 'finalizado';

    if (willBeFinalizado) {
      onFinish(contactId);
    } else if (wasFinalizado) {
      onReopen(contactId);
    } else {
      onMoveStage(contactId, nextStage as FunnelStage);
    }
  };

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const pipelineTotal = filtered.reduce((acc, c) => acc + parseEstimatedValue(c.estimatedValue), 0);

  const visibleStages = mobileSelectedStage === 'todos'
    ? STAGES
    : STAGES.filter((s) => s.id === mobileSelectedStage);

  return (
    <div
      className="flex-1 flex flex-col h-full bg-slate-100/90 overflow-hidden font-sans"
      data-od-id="crm-kanban-view"
    >
      {/* Sub-header do Kanban com Filtros e Métricas */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Funil de Leads & Oportunidades</span>
              <span className="text-xs font-mono font-normal bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {filtered.length} leads
              </span>
            </h2>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar no funil..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <span>Pipeline Total:</span>
            <span className="font-mono font-bold text-emerald-700">
              {pipelineTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>

      {/* Seletor Rápido de Etapas para Mobile (visível apenas em telas pequenas < md) */}
      <div className="md:hidden bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold flex items-center gap-1 shrink-0">
          <Filter className="w-3 h-3" /> Etapa:
        </span>
        <button
          onClick={() => setMobileSelectedStage('todos')}
          className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all shrink-0 ${
            mobileSelectedStage === 'todos'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todas ({filtered.length})
        </button>
        {STAGES.map((s) => {
          const count = filtered.filter((c) => kanbanStageOf(c) === s.id).length;
          const isActive = mobileSelectedStage === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setMobileSelectedStage(s.id)}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{s.shortLabel}</span>
              <span className="text-[10px] opacity-80 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Grid de Colunas do Funil */}
      <div className="flex-1 overflow-x-auto p-3 sm:p-6">
        <div className={`flex gap-4 sm:gap-5 h-full ${mobileSelectedStage === 'todos' ? 'min-w-full sm:min-w-[1350px]' : 'w-full'}`}>
          {visibleStages.map((stage) => {
            const stageContacts = filtered.filter((c) => kanbanStageOf(c) === stage.id);
            const totalStageValue = stageContacts.reduce((acc, curr) => acc + parseEstimatedValue(curr.estimatedValue), 0);

            return (
              <div
                key={stage.id}
                className="flex-1 flex flex-col bg-slate-50/90 rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs min-w-[280px] sm:min-w-0"
                data-od-id={`kanban-column-${stage.id}`}
              >
                {/* Header da Coluna */}
                <div className={`p-3 sm:p-3.5 bg-white border-t-4 ${stage.color} border-b border-slate-200 flex items-center justify-between`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900">{stage.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${stage.bgBadge}`}>
                        {stageContacts.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 font-medium">
                      R$ {totalStageValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Lista de Cards da Etapa */}
                <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-3">
                  {stageContacts.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium">
                      Nenhum lead nesta etapa
                    </div>
                  ) : (
                    stageContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 space-y-3 group"
                        data-od-id={`kanban-card-${contact.id}`}
                      >
                        {/* Topo do Card: Foto, Nome e Telefone */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AvatarBadge name={contact.name} size={36} className="ring-2 ring-slate-100" />
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-slate-900 truncate">
                                {contact.name}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" /> {contact.phone}
                              </p>
                            </div>
                          </div>

                          {contact.clinicName && (
                            <span
                              className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[9.5px] font-semibold text-sky-700 border border-sky-100"
                              title={contact.clinicName}
                            >
                              {contact.clinicName}
                            </span>
                          )}
                        </div>

                        {/* Última Interação */}
                        <div className="bg-slate-50 p-2.5 rounded-xl space-y-1 border border-slate-100">
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed italic">
                            &ldquo;{contact.lastMessage}&rdquo;
                          </p>
                          {contact.lastMessageTime && (
                            <p className="text-[10px] text-slate-400 font-mono font-medium">{contact.lastMessageTime}</p>
                          )}
                        </div>

                        {/* Tags e Valor Estimado */}
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {contact.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                            <span className="text-[11px] text-slate-400 font-medium">Potencial:</span>
                            <span className="font-mono font-bold text-emerald-700">
                              {contact.estimatedValue || '—'}
                            </span>
                          </div>
                        </div>

                        {/* Ações Rápidas: Mover Etapa e Abrir Chat */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            {stage.id !== 'novos' && (
                              <button
                                onClick={() => moveStage(contact.id, 'backward')}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-95"
                                title="Voltar etapa"
                              >
                                <ArrowLeft className="w-4 h-4" />
                              </button>
                            )}
                            {stage.id !== 'finalizado' && (
                              <button
                                onClick={() => moveStage(contact.id, 'forward')}
                                className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-95"
                                title="Avançar etapa"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {onOpenContactChat && (
                            <button
                              onClick={() => onOpenContactChat(contact.id)}
                              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline py-1 px-2 rounded-lg hover:bg-emerald-50 transition-colors"
                            >
                              💬 Abrir no Chat
                            </button>
                          )}
                        </div>
                      </div>
                    ))
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


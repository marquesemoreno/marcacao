"use client";

import React, { useState } from 'react';
import { Contact, FunnelStage } from '@/types/chat-crm';
import { AvatarBadge } from './avatar-badge';
import {
  Search,
  Phone,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

type KanbanStage = FunnelStage | 'finalizado';

interface CRMKanbanProps {
  contacts: Contact[];
  onOpenContactChat?: (contactId: string) => void;
  onMoveStage: (contactId: string, stage: FunnelStage) => void;
  onFinish: (contactId: string) => void;
  onReopen: (contactId: string) => void;
}

const STAGES: { id: KanbanStage; title: string; color: string; bgBadge: string }[] = [
  { id: 'novos', title: '🆕 Novos Contatos', color: 'border-amber-400', bgBadge: 'bg-amber-100 text-amber-800' },
  { id: 'triagem', title: '💬 Em Atendimento', color: 'border-blue-400', bgBadge: 'bg-blue-100 text-blue-800' },
  { id: 'orcamento', title: '💲 Orçamento Enviado', color: 'border-purple-400', bgBadge: 'bg-purple-100 text-purple-800' },
  { id: 'agendado', title: '✅ Agendamento Confirmado', color: 'border-emerald-500', bgBadge: 'bg-emerald-100 text-emerald-800' },
  { id: 'finalizado', title: '🏁 Finalizado', color: 'border-slate-400', bgBadge: 'bg-slate-200 text-slate-700' },
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

  return (
    <div
      className="flex-1 flex flex-col h-full bg-slate-100/90 overflow-hidden font-sans"
      data-od-id="crm-kanban-view"
    >
      {/* Sub-header do Kanban com Filtros e Métricas */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Funil de Leads & Oportunidades</span>
            <span className="text-xs font-mono font-normal bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {filtered.length} leads
            </span>
          </h2>

          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar no funil por nome ou tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <span>Pipeline Total Estimado:</span>
            <span className="font-mono font-bold text-emerald-700">
              {pipelineTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Colunas do Funil */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-5 h-full min-w-[1350px]">
          {STAGES.map((stage) => {
            const stageContacts = filtered.filter((c) => kanbanStageOf(c) === stage.id);
            const totalStageValue = stageContacts.reduce((acc, curr) => acc + parseEstimatedValue(curr.estimatedValue), 0);

            return (
              <div
                key={stage.id}
                className="flex-1 flex flex-col bg-slate-50/80 rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs"
                data-od-id={`kanban-column-${stage.id}`}
              >
                {/* Header da Coluna */}
                <div className={`p-3.5 bg-white border-t-4 ${stage.color} border-b border-slate-200 flex items-center justify-between`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs text-slate-900">{stage.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${stage.bgBadge}`}>
                        {stageContacts.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      R$ {totalStageValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Lista de Cards da Etapa */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {stageContacts.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400">
                      Nenhum lead nesta etapa
                    </div>
                  ) : (
                    stageContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:shadow-md transition-all space-y-3 group"
                        data-od-id={`kanban-card-${contact.id}`}
                      >
                        {/* Topo do Card: Foto, Nome e Telefone */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AvatarBadge name={contact.name} size={36} className="ring-1 ring-slate-200" />
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs text-slate-900 truncate">
                                {contact.name}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" /> {contact.phone}
                              </p>
                            </div>
                          </div>

                          {contact.clinicName && (
                            <span
                              className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[9.5px] font-semibold text-sky-700"
                              title={contact.clinicName}
                            >
                              {contact.clinicName}
                            </span>
                          )}
                        </div>

                        {/* Última Interação */}
                        <div className="bg-slate-50 p-2 rounded-lg space-y-0.5">
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            &ldquo;{contact.lastMessage}&rdquo;
                          </p>
                          {contact.lastMessageTime && (
                            <p className="text-[10px] text-slate-400 font-mono">{contact.lastMessageTime}</p>
                          )}
                        </div>

                        {/* Tags e Valor Estimado */}
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {contact.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                            <span className="text-[11px] text-slate-400">Potencial:</span>
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
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                                title="Voltar etapa"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {stage.id !== 'finalizado' && (
                              <button
                                onClick={() => moveStage(contact.id, 'forward')}
                                className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                                title="Avançar etapa"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {onOpenContactChat && (
                            <button
                              onClick={() => onOpenContactChat(contact.id)}
                              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
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

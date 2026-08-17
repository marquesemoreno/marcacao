"use client";

import React, { useState } from 'react';
import {
  Contact,
  Message,
  Department,
  InboxFilter,
  FunnelStage,
  Agent,
} from '@/types/chat-crm';
import { MessageBubble } from './message-bubble';
import { ScheduleModal } from './schedule-modal';
import { AvatarBadge } from './avatar-badge';
import {
  Search,
  Send,
  Lock,
  Paperclip,
  Mic,
  ChevronDown,
  UserPlus,
  CheckCircle2,
  Calendar,
  Tag,
  Plus,
  X,
  Phone,
  MessageSquare,
  Zap,
  Clock,
  Filter,
} from 'lucide-react';

interface InboxLayoutProps {
  contacts: Contact[];
  agents: Agent[];
  messages: Message[];
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  filterTab: InboxFilter;
  onFilterTabChange: (tab: InboxFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  quickReplies: { id: string; shortcut: string; content: string }[];
  onSendMessage: (text: string, mode: 'whatsapp' | 'internal_note') => Promise<void> | void;
  onAddTag: (tag: string) => Promise<void> | void;
  onRemoveTag: (tag: string) => Promise<void> | void;
  onUpdateFunnelStage: (stage: FunnelStage) => Promise<void> | void;
  onTransferAgent: (agentId: string, agentName: string) => Promise<void> | void;
  onFinishAttendance: () => Promise<void> | void;
  onScheduleConfirmed: (data: { specialty: string; doctor: string; date: string; time: string; price: string }) => void;
}

export const InboxLayout: React.FC<InboxLayoutProps> = ({
  contacts,
  agents,
  messages,
  selectedContactId,
  onSelectContact,
  filterTab,
  onFilterTabChange,
  searchQuery,
  onSearchChange,
  quickReplies,
  onSendMessage,
  onAddTag,
  onRemoveTag,
  onUpdateFunnelStage,
  onTransferAgent,
  onFinishAttendance,
  onScheduleConfirmed,
}) => {
  const [selectedDept, setSelectedDept] = useState<Department | 'todos'>('todos');
  const [composerMode, setComposerMode] = useState<'whatsapp' | 'internal_note'>('whatsapp');
  const [inputText, setInputText] = useState('');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isTransferMenuOpen, setIsTransferMenuOpen] = useState(false);
  const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;

  const filteredContacts = contacts.filter((contact) => {
    if (selectedDept !== 'todos' && contact.department !== selectedDept) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        contact.name.toLowerCase().includes(q) ||
        contact.phone.includes(q) ||
        contact.lastMessage.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedContact) return;
    await onSendMessage(inputText.trim(), composerMode);
    setInputText('');
  };

  const handleAddTag = async () => {
    if (!newTagInput.trim() || !selectedContact) return;
    const tag = newTagInput.trim();
    if (!selectedContact.tags.includes(tag)) {
      await onAddTag(tag);
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  return (
    <div className="flex h-[calc(100vh-65px)] w-full overflow-hidden bg-slate-100 font-sans antialiased text-slate-800">
      {/* =========================================================================
          COLUNA 1: FILA DE ATENDIMENTO (320px)
         ========================================================================= */}
      <aside
        className="w-80 min-w-[320px] max-w-[320px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0 z-10 select-none"
        data-od-id="inbox-queue-column"
      >
        {/* Header & Busca */}
        <div className="p-3.5 border-b border-slate-100 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Fila de Atendimento
            </h2>
            <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {filteredContacts.length} ativas
            </span>
          </div>

          {/* Barra de Busca */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar paciente, telefone ou mensagem..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Abas em Pílula */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
            {(
              [
                { id: 'minhas', label: 'Minhas' },
                { id: 'nao_atribuidas', label: 'Não Atribuídas' },
                { id: 'todas', label: 'Todas' },
                { id: 'finalizadas', label: 'Finalizadas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => onFilterTabChange(tab.id)}
                className={`flex-1 py-1 px-1.5 rounded-md text-[11px] transition-all whitespace-nowrap text-center ${
                  filterTab === tab.id
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtro por Departamento */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1">
              <Filter className="w-3 h-3" /> Depto:
            </span>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  { id: 'recepcao', label: 'Recepção' },
                  { id: 'agendamento', label: 'Agendamento' },
                  { id: 'financeiro', label: 'Financeiro' },
                ] as const
              ).map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className={`px-2 py-0.5 text-[10.5px] rounded-full font-medium transition-colors whitespace-nowrap ${
                    selectedDept === dept.id
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  {dept.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de Conversas com Cards Modernos */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <MessageSquare className="w-8 h-8 text-slate-300" />
              Nenhuma conversa encontrada neste filtro.
            </div>
          ) : (
            filteredContacts.map((c) => {
              const isSelected = c.id === selectedContact?.id;
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectContact(c.id)}
                  className={`p-3.5 transition-all cursor-pointer relative flex gap-3 items-start ${
                    isSelected
                      ? 'bg-emerald-50/50 border-l-4 border-emerald-600'
                      : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                  data-od-id={`contact-card-${c.id}`}
                >
                  {/* Avatar + Badge do Canal */}
                  <div className="relative shrink-0 mt-0.5">
                    <AvatarBadge name={c.name} size={40} className="ring-2 ring-white shadow-xs" />
                    {c.channel === 'whatsapp' && (
                      <span
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-white"
                        title="Canal: WhatsApp"
                      >
                        <MessageSquare className="w-2.5 h-2.5 fill-current" />
                      </span>
                    )}
                  </div>

                  {/* Detalhes da Conversa */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="font-semibold text-xs text-slate-900 truncate max-w-[140px]">
                        {c.name}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 font-medium">
                        {c.lastMessageTime}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 truncate mb-1.5 leading-snug">
                      {c.lastMessage}
                    </p>

                    {/* Footer do Card: Tag de Status e Contador de não lidas */}
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full ${
                          c.statusTag.variant === 'emerald'
                            ? 'bg-emerald-100/90 text-emerald-800'
                            : c.statusTag.variant === 'amber'
                            ? 'bg-amber-100/90 text-amber-800'
                            : c.statusTag.variant === 'blue'
                            ? 'bg-blue-100/90 text-blue-800'
                            : c.statusTag.variant === 'purple'
                            ? 'bg-purple-100/90 text-purple-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.statusTag.label}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-medium truncate max-w-[70px]">
                          {c.department}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-xs">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* =========================================================================
          COLUNA 2: JANELA DE CHAT CENTRAL (FLEXÍVEL)
         ========================================================================= */}
      <main
        className="flex-1 flex flex-col h-full bg-[#f8fafc] min-w-0 relative"
        data-od-id="inbox-chat-column"
      >
        {!selectedContact ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Selecione uma conversa na fila ao lado.
          </div>
        ) : (
          <>
            {/* Header da Conversa */}
            <header className="h-16 bg-white border-b border-slate-200/90 px-5 flex items-center justify-between shrink-0 shadow-xs z-10">
              <div className="flex items-center gap-3 min-w-0">
                <AvatarBadge name={selectedContact.name} size={40} className="ring-2 ring-slate-100 shadow-xs" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 text-sm truncate">
                      {selectedContact.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      WhatsApp Conectado
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono truncate">{selectedContact.phone}</p>
                </div>
              </div>

              {/* Ações do Header (Atendente Responsável + Finalizar) */}
              <div className="flex items-center gap-3">
                {/* Dropdown Atendente / Transferência */}
                <div className="relative">
                  <button
                    onClick={() => setIsTransferMenuOpen(!isTransferMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-2xs"
                  >
                    <span className="text-slate-400">Atendente:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[110px]">
                      {selectedContact.responsibleAgent}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {isTransferMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                      <div className="px-3 py-1.5 text-[10px] font-mono uppercase font-bold text-slate-400 border-b border-slate-100">
                        Transferir Atendimento
                      </div>
                      {agents.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-400">Nenhum outro atendente na clínica.</div>
                      ) : (
                        agents.map((agent) => (
                          <button
                            key={agent.id}
                            onClick={() => {
                              onTransferAgent(agent.id, agent.name);
                              setIsTransferMenuOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 hover:bg-slate-50 transition-colors"
                          >
                            <AvatarBadge name={agent.name} size={24} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 truncate">{agent.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{agent.role}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Finalizar Atendimento */}
                <button
                  onClick={() => onFinishAttendance()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-2xs"
                  title="Encerrar protocolo atual"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Finalizar Atendimento
                </button>
              </div>
            </header>

            {/* Área de Mensagens com Scroll e Fundo Estilizado */}
            <div
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] bg-slate-50/70"
              data-od-id="chat-messages-area"
            >
              {messages.length === 0 ? (
                <p className="text-center text-xs text-slate-400 mt-8">Nenhuma mensagem ainda nesta conversa.</p>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
              )}
            </div>

            {/* Barra de Envio Inferior */}
            <footer
              className="p-3.5 bg-white border-t border-slate-200/90 shrink-0 shadow-sm"
              data-od-id="inbox-composer"
            >
              {/* Alternador WhatsApp vs Nota Interna */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-xs font-medium border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setComposerMode('whatsapp')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-all ${
                        composerMode === 'whatsapp'
                          ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Mensagem WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode('internal_note')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-all ${
                        composerMode === 'internal_note'
                          ? 'bg-amber-500 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Nota Interna Privada
                    </button>
                  </div>

                  {composerMode === 'internal_note' && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      🔒 Visível apenas para a equipe da clínica
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  Pressione Enter para enviar
                </span>
              </div>

              {/* Campo de Digitação e Ações Rápidas */}
              <form onSubmit={handleSendMessage} className="space-y-2 relative">
                {isQuickReplyOpen && quickReplies.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-30 max-h-56 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase font-bold text-slate-400 border-b border-slate-100">
                      Respostas rápidas
                    </div>
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.id}
                        type="button"
                        onClick={() => {
                          setInputText((prev) => (prev ? `${prev} ${reply.content}` : reply.content));
                          setIsQuickReplyOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors"
                      >
                        <p className="font-medium text-emerald-700">{reply.shortcut}</p>
                        <p className="text-slate-500 truncate">{reply.content}</p>
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`rounded-xl border transition-all ${
                    composerMode === 'internal_note'
                      ? 'bg-amber-50/40 border-amber-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200'
                      : 'bg-slate-50 border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100'
                  }`}
                >
                  <textarea
                    rows={2}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder={
                      composerMode === 'internal_note'
                        ? 'Escreva um comentário ou instrução para a equipe...'
                        : 'Digite a resposta para o paciente...'
                    }
                    className="w-full p-3 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none"
                  />

                  {/* Botões de Ações: Anexo, Áudio, Atalhos, Enviar */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200/40 bg-white/50 rounded-b-xl">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled
                        title="Envio de anexos ainda não disponível"
                        className="p-1.5 text-slate-300 rounded-lg cursor-not-allowed"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Gravação de áudio ainda não disponível"
                        className="p-1.5 text-slate-300 rounded-lg cursor-not-allowed"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsQuickReplyOpen((prev) => !prev)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-md transition-colors font-mono"
                        title="Respostas rápidas"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        /respostas
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all ${
                        !inputText.trim()
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : composerMode === 'internal_note'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <span>{composerMode === 'internal_note' ? 'Salvar Nota' : 'Enviar'}</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            </footer>
          </>
        )}
      </main>

      {/* =========================================================================
          COLUNA 3: PAINEL DO CONTATO & CRM (300px)
         ========================================================================= */}
      {selectedContact && (
        <aside
          className="w-[300px] min-w-[300px] max-w-[300px] bg-white border-l border-slate-200 flex flex-col h-full shrink-0 overflow-y-auto"
          data-od-id="inbox-crm-column"
        >
          {/* Header do Painel */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              Perfil & CRM do Lead
            </h3>
          </div>

          <div className="p-4 space-y-5">
            {/* Card com Dados Cadastrais */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-3 pb-2.5 border-b border-slate-200/60">
                <AvatarBadge name={selectedContact.name} size={44} className="ring-2 ring-white shadow-2xs" />
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 text-xs truncate">
                    {selectedContact.name}
                  </h4>
                  <p className="text-[11px] text-emerald-700 font-semibold font-mono flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedContact.phone}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                {selectedContact.cpf && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">CPF:</span>
                    <span className="font-mono text-slate-800 font-semibold">{selectedContact.cpf}</span>
                  </div>
                )}
                {selectedContact.estimatedValue && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Potencial:</span>
                    <span className="text-emerald-700 font-mono font-bold">
                      {selectedContact.estimatedValue}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Seletor de Etapa do Funil CRM */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Etapa do Funil CRM
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'novos', label: 'Novo Lead' },
                    { id: 'triagem', label: 'Em Atendimento' },
                    { id: 'orcamento', label: 'Orçamento' },
                    { id: 'agendado', label: 'Agendado' },
                  ] as const
                ).map((stage) => {
                  const isActive = selectedContact.funnelStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      onClick={() => onUpdateFunnelStage(stage.id)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all text-center border ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {stage.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gerenciador Visual de Tags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Tags do Paciente
                </label>
                {!isAddingTag && (
                  <button
                    onClick={() => setIsAddingTag(true)}
                    className="text-emerald-700 hover:text-emerald-800 text-xs font-semibold flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {selectedContact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 group"
                  >
                    {tag}
                    <button
                      onClick={() => onRemoveTag(tag)}
                      className="text-slate-400 hover:text-rose-600 opacity-60 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {isAddingTag && (
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Nova tag (ex: Particular)..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTag();
                      if (e.key === 'Escape') setIsAddingTag(false);
                    }}
                    autoFocus
                    className="flex-1 text-xs border border-slate-300 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-md text-xs font-medium"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setIsAddingTag(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Histórico Rápido de Consultas */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Histórico Clínico
              </label>

              {selectedContact.consultationHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-center">
                  Nenhum atendimento anterior registrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedContact.consultationHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-800">
                        <span>{item.specialty}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            item.status === 'concluida'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'cancelada'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {item.status === 'concluida' ? 'Concluída' : item.status === 'cancelada' ? 'Cancelada' : 'Agendada'}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] truncate">{item.doctor}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{item.date}</span>
                        {item.price && <span className="font-semibold text-slate-700">{item.price}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botão Verde Destacado: Criar Agendamento Conecta Saúde */}
            <div className="pt-2">
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
                data-od-id="btn-create-schedule"
              >
                <Calendar className="w-4 h-4" />
                Criar Agendamento Conecta Saúde
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Modal de Agendamento */}
      {selectedContact && (
        <ScheduleModal
          contact={selectedContact}
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onConfirmSchedule={onScheduleConfirmed}
        />
      )}
    </div>
  );
};

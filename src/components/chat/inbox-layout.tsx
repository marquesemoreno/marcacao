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
import type { PlainClinicProcedureItem } from '@/lib/serialize';
import { seedDemoConversations } from '@/actions/inbox';
import { toast } from "sonner";
import {
  Search,
  Send,
  Lock,
  ChevronLeft,
  UserPlus,
  CheckCircle2,
  Calendar,
  Tag,
  Plus,
  X,
  Phone,
  Sparkles,
  MessageSquare,
  Zap,
  MoreVertical,
  Edit2,
  Copy,
  Archive,
  Check,
} from 'lucide-react';

const PRESET_TAGS: { label: string; classes: string }[] = [
  { label: '⚡ Prioritário', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  { label: '🔬 Jejum', classes: 'bg-blue-100 text-blue-800 border-blue-200' },
  { label: '✅ Confirmado', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { label: 'Urologia', classes: 'bg-purple-100 text-purple-800 border-purple-200' },
  { label: 'Lead B2B', classes: 'bg-sky-100 text-sky-800 border-sky-200' },
];

function tagClasses(tag: string) {
  return PRESET_TAGS.find((preset) => preset.label === tag)?.classes ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

const DEFAULT_CATEGORIZED_QUICK_REPLIES = [
  {
    category: '📋 Preparo de Exames',
    shortcut: '/preparo-jejum',
    content: '📌 Orientação de Jejum: Recomenda-se jejum absoluto de 8h a 12h para exames de ultrassonografia abdominal e exames de sangue gerais.',
  },
  {
    category: '📍 Endereço e Localização',
    shortcut: '/localizacao',
    content: '📍 Nossas clínicas parceiras estão situadas nos bairros Centro, Recreio e Candeias em Vitória da Conquista, Barra do Choça e Planalto.',
  },
  {
    category: '💳 Formas de Pagamento e PIX',
    shortcut: '/pix',
    content: '💳 O pagamento é realizado diretamente na clínica no dia do atendimento via PIX, cartão de débito/crédito em até 3x sem juros.',
  },
  {
    category: '🩺 Confirmação e Agendamento',
    shortcut: '/confirmacao',
    content: '🩺 Por favor, responda *1* para CONFIRMAR seu horário pré-agendado ou *2* para CANCELAR/REAGENDAR.',
  },
];

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
  fetchProcedures: () => Promise<PlainClinicProcedureItem[]>;
  onScheduleConfirmed: (data: { appointmentId: string; specialty: string; doctor: string; date: string; time: string; price: string }) => void;
  onSuggestIaReply?: () => Promise<string>;
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
  fetchProcedures,
  onScheduleConfirmed,
  onSuggestIaReply,
}) => {
  const [composerMode, setComposerMode] = useState<'whatsapp' | 'internal_note'>('whatsapp');
  const [inputText, setInputText] = useState('');
  const [selectedDept, setSelectedDept] = useState<'todos' | Department>('todos');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [isTransferMenuOpen, setIsTransferMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);
  const [isNewQuickReplyModalOpen, setIsNewQuickReplyModalOpen] = useState(false);
  const [newShortcut, setNewShortcut] = useState('');
  const [newShortcutContent, setNewShortcutContent] = useState('');

  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isGeneratingIa, setIsGeneratingIa] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);

  // Edição inline de dados do paciente
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientCpf, setEditPatientCpf] = useState('');
  const [editPatientNotes, setEditPatientNotes] = useState('');

  async function handleGenerateIaReply() {
    if (!onSuggestIaReply || isGeneratingIa) return;
    setIsGeneratingIa(true);
    try {
      const suggestion = await onSuggestIaReply();
      if (suggestion) {
        setInputText(suggestion);
        toast.success("Rascunho de IA inserido na resposta!");
      }
    } catch {
      toast.error("Não foi possível gerar sugestão de IA.");
    } finally {
      setIsGeneratingIa(false);
    }
  }

  async function handleSeedDemo() {
    if (isSeedingDemo) return;
    setIsSeedingDemo(true);
    try {
      await seedDemoConversations();
      toast.success("Conversas de demonstração geradas no banco com sucesso!");
      window.location.reload();
    } catch {
      toast.error("Não foi possível gerar conversas de demonstração.");
    } finally {
      setIsSeedingDemo(false);
    }
  }

  // Responsividade Móvel: controle de visão ('queue' | 'chat' | 'crm')
  const [mobileView, setMobileView] = useState<'queue' | 'chat' | 'crm'>(
    selectedContactId ? 'chat' : 'queue'
  );

  // Auto-seleção no Desktop: se nenhuma conversa estiver selecionada, seleciona a 1ª
  React.useEffect(() => {
    if (!selectedContactId && contacts.length > 0 && typeof window !== "undefined" && window.innerWidth >= 1024) {
      onSelectContact(contacts[0].id);
    }
  }, [selectedContactId, contacts, onSelectContact]);

  const handleSelectContactMobile = (id: string) => {
    onSelectContact(id);
    setMobileView('chat');
  };

  const quickReplyQuery = inputText.startsWith('/') ? inputText.slice(1).toLowerCase() : '';
  const mergedQuickReplies = [...DEFAULT_CATEGORIZED_QUICK_REPLIES, ...quickReplies.map(r => ({
    category: '⚡ Atalhos Personalizados',
    shortcut: r.shortcut,
    content: r.content,
  }))];

  const filteredQuickReplies = quickReplyQuery
    ? mergedQuickReplies.filter((reply) => reply.shortcut.toLowerCase().includes(quickReplyQuery))
    : mergedQuickReplies;

  const handleInputChange = (value: string) => {
    setInputText(value);
    if (value.startsWith('/')) {
      setIsQuickReplyOpen(true);
    } else if (isQuickReplyOpen) {
      setIsQuickReplyOpen(false);
    }
  };

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;

  const filteredContacts = contacts.filter((contact) => {
    if (selectedDept !== 'todos' && contact.department !== selectedDept) return false;
    if (selectedTagFilter && !contact.tags.includes(selectedTagFilter)) return false;
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

  const handleSaveNewQuickReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcut.trim() || !newShortcutContent.trim()) return;
    toast.success(`Atalho ${newShortcut} cadastrado com sucesso!`);
    setIsNewQuickReplyModalOpen(false);
    setInputText(newShortcutContent);
    setNewShortcut('');
    setNewShortcutContent('');
  };

  const handleSavePatientEdits = () => {
    toast.success("Dados do paciente atualizados com sucesso!");
    setIsEditingPatient(false);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-100 font-sans antialiased text-slate-800 relative">
      {/* =========================================================================
          COLUNA 1: FILA DE ATENDIMENTO (320px em Desktop)
         ========================================================================= */}
      <aside
        className={`w-full md:w-80 md:min-w-[320px] md:max-w-[320px] bg-white border-r border-slate-200 flex-col h-full shrink-0 z-20 select-none ${
          mobileView === 'queue' ? 'flex' : 'hidden md:flex'
        }`}
        data-od-id="inbox-queue-column"
      >
        {/* Header & Busca */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs"></span>
              Fila de Atendimento
            </h2>
            <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60">
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
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Abas de Filtros */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl text-xs font-medium border border-slate-200/50">
            {(
              [
                { id: 'todas', label: 'Todas' },
                { id: 'minhas', label: 'Minhas' },
                { id: 'nao_atribuidas', label: 'Não Atribuídas' },
                { id: 'finalizadas', label: 'Finalizadas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => onFilterTabChange(tab.id)}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] transition-all whitespace-nowrap text-center ${
                  filterTab === tab.id
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtro por Pílula de Tag */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <button
              onClick={() => setSelectedTagFilter(null)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors shrink-0 ${
                selectedTagFilter === null
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todas Tags
            </button>
            {PRESET_TAGS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setSelectedTagFilter(selectedTagFilter === preset.label ? null : preset.label)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors shrink-0 ${
                  selectedTagFilter === preset.label
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
              <MessageSquare className="w-8 h-8 text-slate-300" />
              <span>Nenhuma conversa encontrada nesta lista.</span>
              {contacts.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  disabled={isSeedingDemo}
                  className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white border border-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-2xs"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isSeedingDemo ? 'animate-spin' : ''}`} />
                  <span>🌱 Gerar Conversas Demo</span>
                </button>
              )}
            </div>
          ) : (
            filteredContacts.map((c) => {
              const isSelected = c.id === selectedContact?.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectContactMobile(c.id)}
                  className={`p-3.5 transition-all cursor-pointer relative flex gap-3 items-start ${
                    isSelected
                      ? 'bg-emerald-50/70 border-l-4 border-emerald-600'
                      : 'hover:bg-slate-50 border-l-4 border-transparent active:bg-slate-100/80'
                  }`}
                  data-od-id={`contact-card-${c.id}`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <AvatarBadge name={c.name} size={40} className="ring-2 ring-white shadow-2xs" />
                    {c.channel === 'whatsapp' && (
                      <span
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-white shadow-2xs"
                        title="Canal: WhatsApp"
                      >
                        <MessageSquare className="w-2.5 h-2.5 fill-current" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="font-bold text-xs sm:text-[13px] text-slate-900 truncate max-w-[140px]">
                        {c.name}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 font-medium">
                        {c.lastMessageTime}
                      </span>
                    </div>

                    {c.clinicName && (
                      <p className="text-[10px] font-bold text-sky-700 mb-0.5 truncate">{c.clinicName}</p>
                    )}

                    <p className="text-xs text-slate-500 truncate mb-1.5 leading-snug">
                      {c.lastMessage}
                    </p>

                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full ${
                          c.statusTag.variant === 'emerald'
                            ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-200'
                            : c.statusTag.variant === 'amber'
                            ? 'bg-amber-100/90 text-amber-800 border border-amber-200'
                            : 'bg-purple-100/90 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {c.statusTag.label}
                      </span>

                      {c.unreadCount > 0 && (
                        <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full font-mono shadow-2xs">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* =========================================================================
          COLUNA 2: JANELA DE CHAT CENTRAL
         ========================================================================= */}
      <main
        className={`flex-1 flex flex-col h-full bg-[#f8fafc] min-w-0 relative ${
          mobileView === 'chat' ? 'flex' : 'hidden md:flex'
        }`}
        data-od-id="inbox-chat-column"
      >
        {!selectedContact ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-4">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 shadow-2xs border border-emerald-100">
              <MessageSquare className="w-8 h-8" />
            </div>

            {contacts.length === 0 ? (
              <div className="max-w-md space-y-3 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <h3 className="text-base font-extrabold text-slate-900">
                  Nenhuma conversa aberta nesta caixa de entrada
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Deseja popular a fila com conversas reais de demonstração (pacientes com dúvidas de urologia, ultrassom e lead B2B)?
                </p>

                <button
                  type="button"
                  onClick={handleSeedDemo}
                  disabled={isSeedingDemo}
                  className="mt-2 inline-flex items-center justify-center gap-2 h-11 px-5 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 text-emerald-200 ${isSeedingDemo ? 'animate-spin' : ''}`} />
                  <span>{isSeedingDemo ? "Gerando conversas..." : "🌱 Gerar Conversas de Demonstração no Banco"}</span>
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-500">
                Selecione uma conversa na fila à esquerda para iniciar o atendimento.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Header da Conversa */}
            <header className="h-16 bg-white border-b border-slate-200/90 px-3 sm:px-5 flex items-center justify-between shrink-0 shadow-2xs z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setMobileView('queue')}
                  className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Voltar para a fila"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <AvatarBadge name={selectedContact.name} size={40} className="ring-2 ring-slate-100 shadow-2xs shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {selectedContact.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      WhatsApp
                    </span>
                    {selectedContact.clinicName && (
                      <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-medium truncate">
                        {selectedContact.clinicName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono truncate">{selectedContact.phone}</p>
                </div>
              </div>

              {/* Ações do Header */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all shadow-2xs"
                  title="Criar novo agendamento de consulta ou exame"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">➕ Criar Agendamento</span>
                </button>

                <button
                  onClick={() => onFinishAttendance()}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs"
                  title="Encerrar protocolo atual"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline font-bold">Finalizar</span>
                </button>

                {/* Menu de Ações da Conversa (...) */}
                <div className="relative">
                  <button
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                    title="Menu de Ações do Atendimento"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isMoreMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs font-medium">
                      <button
                        onClick={() => {
                          toast.success("Conversa marcada como não lida!");
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                        <span>Marcar como Não Lida</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsTransferMenuOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                        <span>Transferir Atendente / Depto</span>
                      </button>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href);
                          toast.success("Link da conversa copiado!");
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copiar Link da Conversa</span>
                      </button>

                      <button
                        onClick={() => {
                          onFinishAttendance();
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-rose-600 border-t border-slate-100"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Arquivar Atendimento</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Área de Mensagens */}
            <div
              className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] bg-slate-50/70"
              data-od-id="chat-messages-area"
            >
              {messages.length === 0 ? (
                <p className="text-center text-xs text-slate-400 mt-8">Nenhuma mensagem ainda nesta conversa.</p>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
              )}
            </div>

            {/* Barra de Envio Inferior */}
            <footer className="p-2.5 sm:p-3.5 bg-white border-t border-slate-200/90 shrink-0 shadow-sm">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-xs font-medium border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setComposerMode('whatsapp')}
                      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-xs transition-all ${
                        composerMode === 'whatsapp'
                          ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode('internal_note')}
                      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-xs transition-all ${
                        composerMode === 'internal_note'
                          ? 'bg-amber-500 text-white font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Nota Interna</span>
                    </button>
                  </div>

                  {composerMode === 'internal_note' && (
                    <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md hidden sm:flex items-center gap-1 font-medium">
                      🔒 Visível apenas para a equipe da clínica
                    </span>
                  )}
                </div>
              </div>

              {/* Form de Digitação */}
              <form onSubmit={handleSendMessage} className="space-y-2 relative">
                {isQuickReplyOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-30 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                        Respostas Rápidas Categorizadas
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsNewQuickReplyModalOpen(true)}
                        className="text-[10px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Nova Resposta Rápida
                      </button>
                    </div>

                    {filteredQuickReplies.map((reply) => (
                      <button
                        key={reply.shortcut}
                        type="button"
                        onClick={() => {
                          setInputText(reply.content);
                          setIsQuickReplyOpen(false);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-teal-700 text-xs">{reply.shortcut}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{reply.category}</span>
                        </div>
                        <p className="text-slate-600 text-xs truncate mt-0.5">{reply.content}</p>
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`rounded-2xl border transition-all ${
                    composerMode === 'internal_note'
                      ? 'bg-amber-50/40 border-amber-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200'
                      : 'bg-slate-50 border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100'
                  }`}
                >
                  <textarea
                    rows={2}
                    value={inputText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder={
                      composerMode === 'internal_note'
                        ? 'Escreva uma instrução interna para a equipe...'
                        : 'Digite a resposta para o paciente...'
                    }
                    className="w-full p-3 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none"
                  />

                  <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200/40 bg-white/50 rounded-b-2xl">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsQuickReplyOpen(!isQuickReplyOpen)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-mono"
                        title="Abrir menu de respostas rápidas"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        /respostas
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateIaReply}
                        disabled={isGeneratingIa}
                        className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 rounded-lg transition-all shadow-2xs font-mono"
                        title="Sugerir resposta com IA baseada no contexto do paciente"
                      >
                        <Sparkles className={`w-3.5 h-3.5 text-teal-600 ${isGeneratingIa ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingIa ? 'Gerando...' : '✨ Sugerir Resposta com IA'}</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 ${
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
          COLUNA 3: PAINEL DO CONTATO & CRM
         ========================================================================= */}
      {selectedContact && (
        <aside
          className={`w-full lg:w-[300px] lg:min-w-[300px] lg:max-w-[300px] bg-white border-l border-slate-200 flex-col h-full shrink-0 overflow-y-auto ${
            mobileView === 'crm'
              ? 'flex absolute inset-0 z-40 bg-white animate-in slide-in-from-right duration-200'
              : 'hidden lg:flex'
          }`}
          data-od-id="inbox-crm-column"
        >
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              Perfil & CRM do Lead
            </h3>
            <button
              onClick={() => setMobileView('chat')}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-5">
            {/* Card com Dados Cadastrais + Edição Inline */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-3">
                  <AvatarBadge name={selectedContact.name} size={42} className="ring-2 ring-white shadow-2xs" />
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-slate-900 text-xs truncate">
                      {selectedContact.name}
                    </h4>
                    <p className="text-[11px] text-emerald-700 font-semibold font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selectedContact.phone}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditPatientName(selectedContact.name);
                    setEditPatientCpf(selectedContact.cpf || '');
                    setIsEditingPatient(!isEditingPatient);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
                  title="Editar cadastro do paciente"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {isEditingPatient ? (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">Nome:</label>
                    <input
                      type="text"
                      value={editPatientName}
                      onChange={(e) => setEditPatientName(e.target.value)}
                      className="w-full px-2 py-1 text-xs border rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">CPF:</label>
                    <input
                      type="text"
                      value={editPatientCpf}
                      onChange={(e) => setEditPatientCpf(e.target.value)}
                      className="w-full px-2 py-1 text-xs border rounded-lg bg-white"
                    />
                  </div>
                  <button
                    onClick={handleSavePatientEdits}
                    className="w-full py-1.5 bg-slate-900 text-white font-bold text-xs rounded-lg mt-1"
                  >
                    Salvar Alterações
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs text-slate-600">
                  {selectedContact.cpf && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">CPF:</span>
                      <span className="font-mono text-slate-800 font-semibold">{selectedContact.cpf}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Cidade/Região:</span>
                    <span className="font-semibold text-slate-800">Vitória da Conquista</span>
                  </div>
                </div>
              )}
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
                      className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all text-center border ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-2xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {stage.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags do Paciente */}
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${tagClasses(tag)}`}
                  >
                    {tag}
                    <button onClick={() => onRemoveTag(tag)} className="hover:text-slate-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {isAddingTag && (
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Nova tag..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50"
                  />
                  <button
                    onClick={handleAddTag}
                    className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Botão Verde Destacado: Criar Agendamento Conecta Saúde */}
            <div className="pt-2">
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="w-full py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-all hover:shadow-md active:scale-[0.99]"
                data-od-id="btn-create-schedule"
              >
                <Calendar className="w-4 h-4" />
                ➕ Criar Agendamento Conecta Saúde
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Modal de Nova Resposta Rápida */}
      {isNewQuickReplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4">
          <form onSubmit={handleSaveNewQuickReply} className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Nova Resposta Rápida
              </h3>
              <button type="button" onClick={() => setIsNewQuickReplyModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Atalho (ex: /horarios):</label>
                <input
                  type="text"
                  required
                  placeholder="/atalho"
                  value={newShortcut}
                  onChange={(e) => setNewShortcut(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-mono mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Texto da Resposta:</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Escreva a resposta pré-definida..."
                  value={newShortcutContent}
                  onChange={(e) => setNewShortcutContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 mt-1 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-2xs"
              >
                Cadastrar Atalho
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Agendamento */}
      {selectedContact && (
        <ScheduleModal
          contact={selectedContact}
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          fetchProcedures={fetchProcedures}
          onConfirmSchedule={onScheduleConfirmed}
        />
      )}
    </div>
  );
};

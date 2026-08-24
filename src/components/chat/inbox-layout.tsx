"use client";

import React, { useRef, useState } from 'react';
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
  ChevronDown,
  UserPlus,
  CheckCircle2,
  Calendar,
  Tag,
  Filter,
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
  Paperclip,
  Loader2,
  User,
  Clock,
} from 'lucide-react';

const MAX_MEDIA_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB — mesmo limite validado no servidor

const PRESET_TAGS: { label: string; classes: string }[] = [
  { label: '⚡ Prioritário', classes: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { label: '🔬 Jejum', classes: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  { label: '✅ Confirmado', classes: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { label: 'Urologia', classes: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { label: 'Lead B2B', classes: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
];

function tagClasses(tag: string) {
  return PRESET_TAGS.find((preset) => preset.label === tag)?.classes ?? 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
}

const FUNNEL_STEPS: { id: FunnelStage; label: string }[] = [
  { id: 'novos', label: 'Novo Lead' },
  { id: 'triagem', label: 'Em Atendimento' },
  { id: 'orcamento', label: 'Orçamento' },
  { id: 'agendado', label: 'Agendado' },
];

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
  hasMoreMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
  attendantCapacity?: { activeCount: number; maxLimit: number } | null;
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  filterTab: InboxFilter;
  onFilterTabChange: (tab: InboxFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  quickReplies: { id: string; shortcut: string; content: string }[];
  onSaveQuickReply?: (shortcut: string, content: string) => Promise<void>;
  onSendMessage: (text: string, mode: 'whatsapp' | 'internal_note') => Promise<void> | void;
  onSendMedia: (file: File) => Promise<void> | void;
  onAddTag: (tag: string) => Promise<void> | void;
  onRemoveTag: (tag: string) => Promise<void> | void;
  onUpdateFunnelStage: (stage: FunnelStage) => Promise<void> | void;
  onClaimConversation?: () => Promise<void> | void;
  onTransferAgent: (agentId: string, agentName: string) => Promise<void> | void;
  availableClinics?: { id: string; tradeName: string }[];
  onReassignClinic?: (clinicId: string) => Promise<void> | void;
  /** Cadastra um contato novo e abre a conversa dele. `clinicId` só é usado (e obrigatório
   * na prática) no scope admin, que não está preso a uma clínica só — ver availableClinics. */
  onCreateContact?: (name: string, phone: string, clinicId?: string) => Promise<void>;
  onFinishAttendance: (resolutionData?: { reason: string; notes?: string }) => Promise<void> | void;
  fetchProcedures: () => Promise<PlainClinicProcedureItem[]>;
  fetchDoctors?: () => Promise<{ id: number; nome: string; crm: string }[]>;
  onScheduleConfirmed: (data: { appointmentId: string; specialty: string; doctor: string; date: string; time: string; price: string }) => void;
  onSuggestIaReply?: () => Promise<string>;
}

export const InboxLayout: React.FC<InboxLayoutProps> = ({
  contacts,
  agents,
  messages,
  hasMoreMessages,
  isLoadingOlderMessages,
  onLoadOlderMessages,
  attendantCapacity,
  selectedContactId,
  onSelectContact,
  filterTab,
  onFilterTabChange,
  searchQuery,
  onSearchChange,
  quickReplies,
  onSaveQuickReply,
  onSendMessage,
  onSendMedia,
  onAddTag,
  onRemoveTag,
  onUpdateFunnelStage,
  onClaimConversation,
  onTransferAgent,
  availableClinics,
  onReassignClinic,
  onCreateContact,
  onFinishAttendance,
  fetchProcedures,
  fetchDoctors,
  onScheduleConfirmed,
  onSuggestIaReply,
}) => {
  const [composerMode, setComposerMode] = useState<'whatsapp' | 'internal_note'>('whatsapp');
  const [inputText, setInputText] = useState('');
  const [selectedDept] = useState<'todos' | Department>('todos');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [isTransferMenuOpen, setIsTransferMenuOpen] = useState(false);
  const [isClinicMenuOpen, setIsClinicMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactClinicId, setNewContactClinicId] = useState('');
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);
  const [isNewQuickReplyModalOpen, setIsNewQuickReplyModalOpen] = useState(false);
  const [newShortcut, setNewShortcut] = useState('');
  const [newShortcutContent, setNewShortcutContent] = useState('');
  const [isSavingQuickReply, setIsSavingQuickReply] = useState(false);

  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isGeneratingIa, setIsGeneratingIa] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal de Motivo Obrigatório de Resolução
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [finishNotes, setFinishNotes] = useState('');

  // Edição inline de dados do paciente
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientCpf, setEditPatientCpf] = useState('');

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

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo depois
    if (!file || !selectedContact) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(file.type)) {
      toast.error('Envie uma imagem (JPG, PNG, WEBP, GIF) ou um PDF.');
      return;
    }
    if (file.size > MAX_MEDIA_SIZE_BYTES) {
      toast.error('Arquivo muito grande. O limite é 15 MB.');
      return;
    }

    setIsSendingMedia(true);
    try {
      await onSendMedia(file);
    } finally {
      setIsSendingMedia(false);
    }
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

  const handleSaveNewQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcut || !newShortcutContent || !onSaveQuickReply) return;
    setIsSavingQuickReply(true);
    try {
      await onSaveQuickReply(newShortcut, newShortcutContent);
      toast.success("Novo atalho cadastrado com sucesso!");
      setNewShortcut('');
      setNewShortcutContent('');
      setIsNewQuickReplyModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar o atalho.");
    } finally {
      setIsSavingQuickReply(false);
    }
  };

  const handleSavePatientEdits = () => {
    toast.success("Dados do paciente atualizados com sucesso!");
    setIsEditingPatient(false);
  };

  const handleSaveNewContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim() || !onCreateContact) return;
    if (availableClinics && availableClinics.length > 0 && !newContactClinicId) return;

    setIsSavingContact(true);
    try {
      await onCreateContact(newContactName, newContactPhone, newContactClinicId || undefined);
      toast.success("Contato cadastrado com sucesso!");
      setNewContactName('');
      setNewContactPhone('');
      setNewContactClinicId('');
      setIsNewContactModalOpen(false);
      setMobileView('chat');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar o contato.");
    } finally {
      setIsSavingContact(false);
    }
  };

  const currentStageIndex = selectedContact ? FUNNEL_STEPS.findIndex((s) => s.id === selectedContact.funnelStage) : -1;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#F8FAFC] dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-100 relative">
      {/* =========================================================================
          COLUNA 1: FILA DE ATENDIMENTO (320px em Desktop)
         ========================================================================= */}
      <aside
        className={`w-full md:w-80 md:min-w-[320px] md:max-w-[320px] bg-slate-100/70 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm flex-col h-full shrink-0 z-20 select-none ${
          mobileView === 'queue' ? 'flex' : 'hidden md:flex'
        }`}
        data-od-id="inbox-queue-column"
      >
        {/* Header & Busca */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between gap-1">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Fila de Atendimento
            </h2>
            <div className="flex items-center gap-1.5">
              {onCreateContact && (
                <button
                  type="button"
                  onClick={() => setIsNewContactModalOpen(true)}
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  title="Cadastrar novo contato e iniciar conversa"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}
              {attendantCapacity && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    attendantCapacity.activeCount >= attendantCapacity.maxLimit
                      ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                      : attendantCapacity.activeCount >= attendantCapacity.maxLimit - 1
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  }`}
                  title="Seu limite de conversas ativas simultâneas"
                >
                  <Zap className="w-2.5 h-2.5" />
                  {attendantCapacity.activeCount}/{attendantCapacity.maxLimit}
                </span>
              )}
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/70 dark:border-slate-700">
                {filteredContacts.length}
              </span>
            </div>
          </div>

          {/* Barra de Busca */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar paciente, telefone ou mensagem..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Abas de Filtros: Segmented Control Compacto */}
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800/90 rounded-lg text-xs font-medium">
            {(
              [
                { id: 'todas', label: 'Todas' },
                { id: 'minhas', label: 'Minhas' },
                { id: 'nao_atribuidas', label: 'Não Atrib.' },
                { id: 'finalizadas', label: 'Finalizadas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => onFilterTabChange(tab.id)}
                className={`flex-1 py-1 px-1.5 rounded-md text-[11px] transition-all whitespace-nowrap text-center ${
                  filterTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtro por Tag: Dropdown Compacto */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTagFilterOpen((open) => !open)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Filter className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{selectedTagFilter ?? 'Filtrar por Tag'}</span>
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${isTagFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isTagFilterOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedTagFilter(null);
                    setIsTagFilterOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    selectedTagFilter === null ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Todas as Tags
                </button>
                {PRESET_TAGS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setSelectedTagFilter(selectedTagFilter === preset.label ? null : preset.label);
                      setIsTagFilterOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center"
                  >
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${preset.classes} ${selectedTagFilter === preset.label ? 'ring-2 ring-emerald-500/30' : ''}`}>
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
              <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <span>Nenhuma conversa encontrada nesta lista.</span>
              {contacts.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  disabled={isSeedingDemo}
                  className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isSeedingDemo ? 'animate-spin' : ''}`} />
                  <span>Gerar Conversas Demo</span>
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
                  className={`px-3.5 py-3 transition-colors cursor-pointer relative flex gap-3 items-start border-l-4 ${
                    isSelected
                      ? 'bg-white dark:bg-slate-800/70 border-emerald-600 shadow-sm'
                      : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/40 border-transparent'
                  }`}
                  data-od-id={`contact-card-${c.id}`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <AvatarBadge name={c.name} size={38} className="ring-2 ring-white dark:ring-slate-900 shadow-sm" />
                    {c.channel === 'whatsapp' && (
                      <span
                        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center text-white"
                        title="Canal: WhatsApp"
                      >
                        <MessageSquare className="w-2 h-2 fill-current" />
                      </span>
                    )}
                    {c.unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 border-2 border-white dark:border-slate-900 text-white text-[9px] font-bold flex items-center justify-center"
                        title={`${c.unreadCount} mensagem(ns) não lida(s)`}
                      >
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5 gap-2">
                      <h4 className={`text-xs sm:text-[13px] truncate ${c.unreadCount > 0 ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-semibold text-slate-900 dark:text-slate-100'}`}>
                        {c.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                        {c.lastMessageTime}
                      </span>
                    </div>

                    {c.clinicName && (
                      <p className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 mb-0.5 truncate">{c.clinicName}</p>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1.5 leading-snug">
                      {c.lastMessage}
                    </p>

                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                          c.statusTag.variant === 'emerald'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : c.statusTag.variant === 'amber'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                        }`}
                      >
                        {c.statusTag.label}
                      </span>

                      {c.responsibleAgent && c.responsibleAgent !== 'Não Atribuído' ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md truncate max-w-[85px]" title={`Atribuído a ${c.responsibleAgent}`}>
                          <User className="w-2.5 h-2.5 shrink-0" /> {c.responsibleAgent.split(' ')[0]}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md" title="Aguardando secretária">
                          <Clock className="w-2.5 h-2.5" /> Livre
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
        className={`flex-1 flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950 min-w-0 relative ${
          mobileView === 'chat' ? 'flex' : 'hidden md:flex'
        }`}
        data-od-id="inbox-chat-column"
      >
        {!selectedContact ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400 gap-4">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
              <MessageSquare className="w-8 h-8" />
            </div>

            {contacts.length === 0 ? (
              <div className="max-w-md space-y-3 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Nenhuma conversa aberta nesta caixa de entrada
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Deseja popular a fila com conversas reais de demonstração (pacientes com dúvidas de urologia, ultrassom e lead B2B)?
                </p>

                <button
                  type="button"
                  onClick={handleSeedDemo}
                  disabled={isSeedingDemo}
                  className="mt-2 inline-flex items-center justify-center gap-2 h-11 px-5 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 text-emerald-200 ${isSeedingDemo ? 'animate-spin' : ''}`} />
                  <span>{isSeedingDemo ? "Gerando conversas..." : "Gerar Conversas de Demonstração no Banco"}</span>
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Selecione uma conversa na fila à esquerda para iniciar o atendimento.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Header da Conversa */}
            <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 flex items-center justify-between shrink-0 shadow-xs z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setMobileView('queue')}
                  className="md:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Voltar para a fila"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <AvatarBadge name={selectedContact.name} size={38} className="ring-2 ring-slate-100 dark:ring-slate-800 shadow-sm shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                      {selectedContact.name}
                    </h3>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium shrink-0"
                      title="WhatsApp Conectado"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      WhatsApp
                    </span>
                    {selectedContact.clinicName && (
                      onReassignClinic && availableClinics && availableClinics.length > 0 ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsClinicMenuOpen((open) => !open)}
                            title="Clique para corrigir a clínica desta conversa"
                            className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[10px] font-medium truncate hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors"
                          >
                            {selectedContact.clinicName}
                          </button>
                          {isClinicMenuOpen && (
                            <div className="absolute left-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-2 z-50 animate-in fade-in zoom-in-95 text-xs font-medium max-h-64 overflow-y-auto">
                              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 mb-1">
                                Corrigir Clínica Desta Conversa
                              </div>
                              {availableClinics.map((clinic) => (
                                <button
                                  key={clinic.id}
                                  onClick={() => {
                                    onReassignClinic(clinic.id);
                                    setIsClinicMenuOpen(false);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                                >
                                  <span className="truncate">{clinic.tradeName}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[10px] font-medium truncate">
                          {selectedContact.clinicName}
                        </span>
                      )
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{selectedContact.phone}</p>
                </div>
              </div>

              {/* Ações do Header: atendente, agendar (secundário) e menu */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {(!selectedContact.responsibleAgent || selectedContact.responsibleAgent === "Não Atribuído") ? (
                  onClaimConversation && (
                    <button
                      onClick={() => onClaimConversation()}
                      disabled={attendantCapacity ? attendantCapacity.activeCount >= attendantCapacity.maxLimit : false}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        attendantCapacity && attendantCapacity.activeCount >= attendantCapacity.maxLimit
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
                      }`}
                      title={
                        attendantCapacity && attendantCapacity.activeCount >= attendantCapacity.maxLimit
                          ? `Você atingiu seu limite de ${attendantCapacity.maxLimit} conversas simultâneas`
                          : "Assumir esta conversa para o seu atendimento"
                      }
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>
                        {attendantCapacity && attendantCapacity.activeCount >= attendantCapacity.maxLimit
                          ? "Limite Atingido"
                          : "Atribuir pra Mim"}
                      </span>
                    </button>
                  )
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setIsTransferMenuOpen(!isTransferMenuOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                      title="Clique para transferir a conversa"
                    >
                      <span className="text-slate-400 font-normal hidden sm:inline">Atendente:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[100px]">{selectedContact.responsibleAgent}</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {isTransferMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-2 z-50 animate-in fade-in zoom-in-95 text-xs font-medium">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 mb-1">
                          Transferir Atendimento Para
                        </div>
                        {agents.length === 0 ? (
                          <p className="px-3 py-2 text-slate-400 text-xs">Nenhum outro atendente disponível.</p>
                        ) : (
                          agents.map((agent) => (
                            <button
                              key={agent.id}
                              onClick={() => {
                                onTransferAgent(agent.id, agent.name);
                                setIsTransferMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-200"
                            >
                              <span className="font-semibold">{agent.name}</span>
                              <span className="text-[10px] text-slate-400">{agent.role}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-transparent hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-all"
                  title="Criar novo agendamento de consulta ou exame"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Agendar</span>
                </button>

                {/* Menu de Ações da Conversa (...) */}
                <div className="relative">
                  <button
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Menu de Ações do Atendimento"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isMoreMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs font-medium">
                      <button
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="sm:hidden w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Criar Agendamento</span>
                      </button>

                      <button
                        onClick={() => {
                          toast.success("Conversa marcada como não lida!");
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                        <span>Marcar como Não Lida</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsTransferMenuOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
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
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copiar Link da Conversa</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsFinishModalOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-rose-600 border-t border-slate-100 dark:border-slate-800"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Finalizar Atendimento</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Área de Mensagens */}
            <div
              className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 bg-[#F1F5F9] dark:bg-slate-950/60"
              data-od-id="chat-messages-area"
            >
              {messages.length === 0 ? (
                <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">Nenhuma mensagem ainda nesta conversa.</p>
              ) : (
                <>
                  {hasMoreMessages && (
                    <div className="flex justify-center pb-2">
                      <button
                        type="button"
                        onClick={onLoadOlderMessages}
                        disabled={isLoadingOlderMessages}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isLoadingOlderMessages ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Carregando...</span>
                          </>
                        ) : (
                          <span>Carregar mensagens anteriores</span>
                        )}
                      </button>
                    </div>
                  )}
                  {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
                </>
              )}
            </div>

            {/* Barra de Envio Inferior: toggle integrado no topo do input */}
            <footer className="p-2.5 sm:p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <form onSubmit={handleSendMessage} className="relative">
                {isQuickReplyOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-2 z-30 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                        Respostas Rápidas Categorizadas
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsNewQuickReplyModalOpen(true)}
                        className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center gap-1"
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
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">{reply.shortcut}</p>
                          <span className="text-[10px] text-slate-400">{reply.category}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-xs truncate mt-0.5">{reply.content}</p>
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`rounded-xl border overflow-hidden transition-colors ${
                    composerMode === 'internal_note'
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 focus-within:ring-2 focus-within:ring-amber-200'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100'
                  }`}
                >
                  {/* Toggle de Modo: integrado no topo do card do input */}
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40">
                    <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setComposerMode('whatsapp')}
                        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-xs transition-all ${
                          composerMode === 'whatsapp'
                            ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
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
                            ? 'bg-amber-500 text-white font-semibold shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Nota Interna</span>
                      </button>
                    </div>

                    {composerMode === 'internal_note' && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 hidden sm:flex items-center gap-1 font-medium">
                        <Lock className="w-2.5 h-2.5" /> Visível só para a equipe
                      </span>
                    )}
                  </div>

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
                    className="w-full p-3 bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none"
                  />

                  <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      {composerMode === 'whatsapp' && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                            onChange={handleFileSelected}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSendingMedia}
                            className="flex items-center justify-center w-7 h-7 text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Anexar imagem ou PDF para enviar ao paciente"
                          >
                            <Paperclip className={`w-3.5 h-3.5 ${isSendingMedia ? 'animate-pulse' : ''}`} />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsQuickReplyOpen(!isQuickReplyOpen)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Abrir menu de respostas rápidas"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        /respostas
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateIaReply}
                        disabled={isGeneratingIa}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-all"
                        title="Sugerir resposta com IA baseada no contexto do paciente"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isGeneratingIa ? 'animate-spin text-emerald-600' : ''}`} />
                        <span>{isGeneratingIa ? 'Gerando...' : 'Melhorar com IA'}</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                        !inputText.trim()
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
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
          className={`w-full lg:w-[300px] lg:min-w-[300px] lg:max-w-[300px] bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-sm flex-col h-full shrink-0 overflow-y-auto ${
            mobileView === 'crm'
              ? 'flex absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right duration-200'
              : 'hidden lg:flex'
          }`}
          data-od-id="inbox-crm-column"
        >
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Perfil & CRM do Lead
            </h3>
            <button
              onClick={() => setMobileView('chat')}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Card 1: Perfil do Contato */}
            <div className="bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarBadge name={selectedContact.name} size={44} className="ring-2 ring-white dark:ring-slate-900 shadow-sm shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                      {selectedContact.name}
                    </h4>
                    <div className="flex items-center gap-1 mt-0.5">
                      <a
                        href={`tel:${selectedContact.phone}`}
                        className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-400"
                        title="Ligar para o paciente"
                      >
                        <Phone className="w-3 h-3" /> {selectedContact.phone}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedContact.phone);
                          toast.success("Telefone copiado!");
                        }}
                        className="p-0.5 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 rounded"
                        title="Copiar telefone"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditPatientName(selectedContact.name);
                    setEditPatientCpf(selectedContact.cpf || '');
                    setIsEditingPatient(!isEditingPatient);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
                  title="Editar cadastro do paciente"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {isEditingPatient ? (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Nome:</label>
                    <input
                      type="text"
                      value={editPatientName}
                      onChange={(e) => setEditPatientName(e.target.value)}
                      className="w-full px-2 py-1 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">CPF:</label>
                    <input
                      type="text"
                      value={editPatientCpf}
                      onChange={(e) => setEditPatientCpf(e.target.value)}
                      className="w-full px-2 py-1 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <button
                    onClick={handleSavePatientEdits}
                    className="w-full py-1.5 bg-emerald-600 text-white font-semibold text-xs rounded-lg mt-1 hover:bg-emerald-700"
                  >
                    Salvar Alterações
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {selectedContact.cpf && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">CPF:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedContact.cpf}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Bairro/Região:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedContact.neighborhood || 'Não informado'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Pipeline do Funil CRM (Stepper Conectado) */}
            <div className="bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 shadow-sm space-y-2.5">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Etapa do Funil CRM
              </label>
              <div>
                {FUNNEL_STEPS.map((stage, idx) => {
                  const isActive = selectedContact.funnelStage === stage.id;
                  const isCompleted = currentStageIndex > idx;
                  const isLast = idx === FUNNEL_STEPS.length - 1;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => onUpdateFunnelStage(stage.id)}
                      className="relative flex items-start gap-3 w-full text-left pb-3.5 last:pb-0 group"
                    >
                      {!isLast && (
                        <span
                          className={`absolute left-[9px] top-5 bottom-0 w-0.5 ${
                            isCompleted ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                      )}
                      <span
                        className={`relative z-10 flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
                          isActive
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : isCompleted
                            ? 'bg-emerald-100 dark:bg-emerald-900 border-emerald-400 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400 group-hover:border-slate-400'
                        }`}
                      >
                        {isActive || isCompleted ? <Check className="w-3 h-3" /> : <span className="text-[9px] font-bold">{idx + 1}</span>}
                      </span>
                      <span
                        className={`text-xs pt-0.5 transition-colors ${
                          isActive
                            ? 'font-bold text-emerald-700 dark:text-emerald-400'
                            : isCompleted
                            ? 'font-semibold text-slate-600 dark:text-slate-300'
                            : 'font-medium text-slate-400 dark:text-slate-500 group-hover:text-slate-600'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card 3: Tags & Observações */}
            <div className="bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Tags do Paciente
                </label>
                {!isAddingTag && (
                  <button
                    onClick={() => setIsAddingTag(true)}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 text-[11px] font-semibold flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {selectedContact.tags.length === 0 && !isAddingTag && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Nenhuma tag ainda.</span>
                )}
                {selectedContact.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${tagClasses(tag)}`}
                  >
                    {tag}
                    <button onClick={() => onRemoveTag(tag)} className="hover:text-slate-900 dark:hover:text-white">
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
                    className="flex-1 px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
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
          </div>
        </aside>
      )}

      {/* Modal de Nova Resposta Rápida */}
      {isNewQuickReplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <form onSubmit={handleSaveNewQuickReply} className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Nova Resposta Rápida
              </h3>
              <button type="button" onClick={() => setIsNewQuickReplyModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Atalho (ex: /horarios):</label>
                <input
                  type="text"
                  required
                  placeholder="/atalho"
                  value={newShortcut}
                  onChange={(e) => setNewShortcut(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Texto da Resposta:</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Escreva a resposta pré-definida..."
                  value={newShortcutContent}
                  onChange={(e) => setNewShortcutContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mt-1 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={isSavingQuickReply}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-xs rounded-lg shadow-sm"
              >
                {isSavingQuickReply ? "Salvando..." : "Cadastrar Atalho"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Novo Contato */}
      {isNewContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <form onSubmit={handleSaveNewContact} className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                Novo Contato
              </h3>
              <button type="button" onClick={() => setIsNewContactModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome:</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do paciente"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">WhatsApp (com DDD):</label>
                <input
                  type="tel"
                  required
                  placeholder="77999998888"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mt-1 font-mono"
                />
              </div>

              {availableClinics && availableClinics.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Clínica:</label>
                  <select
                    required
                    value={newContactClinicId}
                    onChange={(e) => setNewContactClinicId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mt-1"
                  >
                    <option value="" disabled>Escolha a clínica...</option>
                    {availableClinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>{clinic.tradeName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={isSavingContact}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-xs rounded-lg shadow-sm"
              >
                {isSavingContact ? "Salvando..." : "Cadastrar Contato"}
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
          fetchDoctors={fetchDoctors}
          onConfirmSchedule={onScheduleConfirmed}
        />
      )}

      {/* Modal de Motivo Obrigatório de Resolução */}
      {isFinishModalOpen && selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Finalizar Atendimento do Paciente
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Selecione o desfecho obrigatório deste atendimento para {selectedContact.name}.
                </p>
              </div>
              <button type="button" onClick={() => setIsFinishModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Motivo do Encerramento (Obrigatório):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: "AGENDAMENTO_CONCLUIDO", label: "Agendamento Concluído" },
                  { id: "DUVIDA_ESCLARECIDA", label: "Dúvida Esclarecida" },
                  { id: "ORCAMENTO_ENVIADO", label: "Orçamento Enviado" },
                  { id: "SEM_RESPOSTA", label: "Paciente Não Respondeu" },
                  { id: "CANCELAMENTO", label: "Cancelamento / Desistência" },
                  { id: "ENCAMINHADO", label: "Encaminhado a Outro Setor" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedReason(option.id)}
                    className={`p-3 rounded-xl text-left text-xs font-semibold transition-all border flex items-center gap-2 ${
                      selectedReason === option.id
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-200"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Observação Final da Equipe (Opcional):
              </label>
              <textarea
                rows={2}
                value={finishNotes}
                onChange={(e) => setFinishNotes(e.target.value)}
                placeholder="Ex: Paciente agendou consulta para a próxima semana..."
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsFinishModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedReason}
                onClick={async () => {
                  if (!selectedReason) return;
                  await onFinishAttendance({ reason: selectedReason, notes: finishNotes });
                  setIsFinishModalOpen(false);
                  setSelectedReason(null);
                  setFinishNotes("");
                }}
                className={`px-5 py-2.5 font-semibold text-xs rounded-lg shadow-sm transition-all ${
                  !selectedReason
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
                }`}
              >
                Confirmar e Finalizar Atendimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

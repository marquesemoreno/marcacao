"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  listChatContacts,
  listChatAgents,
  getChatMessages,
  getOlderChatMessages,
  getChatContactHistory,
  sendMessage,
  sendMediaMessage,
  updateConversationTags,
  updateConversationFunnelStage,
  assignConversationToUser,
  claimConversation,
  transferConversation,
  getAttendantCapacity,
  resolveConversation,
  reopenConversation,
  listCannedResponses,
  createCannedResponse,
  createContact,
  listClinicProceduresForAppointment,
  listClinicDoctorsForAppointment,
  suggestIaReply,
} from "@/actions/inbox";
import {
  listChatContactsAdmin,
  listChatAgentsAdmin,
  getChatMessagesAdmin,
  getOlderChatMessagesAdmin,
  getChatContactHistoryAdmin,
  sendMessageAdmin,
  sendMediaMessageAdmin,
  updateConversationTagsAdmin,
  updateConversationFunnelStageAdmin,
  assignConversationToUserAdmin,
  claimConversationAdmin,
  transferConversationAdmin,
  getAttendantCapacityAdmin,
  resolveConversationAdmin,
  reopenConversationAdmin,
  listCannedResponsesAdmin,
  createCannedResponseAdmin,
  createContactAdmin,
  listClinicProceduresForAppointmentAdmin,
  listClinicDoctorsForAppointmentAdmin,
  suggestIaReplyAdmin,
  listClinicsForReassignment,
  updateConversationClinicAdmin,
} from "@/actions/admin-inbox";
import { toast } from "sonner";
import { useInboxRealtime } from "@/hooks/use-inbox-realtime";
import { playNotificationSound } from "@/lib/notification-sound";
import { formatFileSize } from "@/lib/format";
import {
  requestNotificationPermission,
  showDesktopNotification,
  updateTabTitleUnreadCount,
} from "@/lib/browser-notifications";
import { InboxLayout } from "./inbox-layout";
import { CRMKanban } from "./crm-kanban";
import type { Agent, Contact, FunnelStage, InboxFilter, Message } from "@/types/chat-crm";

type Scope = "clinic" | "admin";
type View = "inbox" | "crm";

const ACTIONS_BY_SCOPE = {
  clinic: {
    listChatContacts: (filter: InboxFilter, search?: string) => listChatContacts(filter, search),
    listChatAgents: () => listChatAgents(),
    getChatMessages: (id: string) => getChatMessages(id),
    getOlderChatMessages: (id: string, beforeId: string) => getOlderChatMessages(id, beforeId),
    getChatContactHistory: (id: string) => getChatContactHistory(id),
    sendMessage: (id: string, text: string, note?: boolean) => sendMessage(id, text, note),
    sendMediaMessage: (id: string, formData: FormData) => sendMediaMessage(id, formData),
    updateConversationTags: (id: string, tags: string[]) => updateConversationTags(id, tags),
    updateConversationFunnelStage: (id: string, stage: FunnelStage) => updateConversationFunnelStage(id, stage),
    assignConversationToUser: (id: string, userId: string | null) => assignConversationToUser(id, userId ?? ""),
    resolveConversation: (id: string, data?: { reason: string; notes?: string }) => resolveConversation(id, data),
    reopenConversation: (id: string) => reopenConversation(id),
    listCannedResponses: () => listCannedResponses(),
    createCannedResponse: (shortcut: string, content: string) => createCannedResponse(shortcut, content),
    suggestIaReply: (id: string) => suggestIaReply(id),
  },
  admin: {
    listChatContacts: (filter: InboxFilter, search?: string) => listChatContactsAdmin(filter, search),
    listChatAgents: () => listChatAgentsAdmin(),
    getChatMessages: (id: string) => getChatMessagesAdmin(id),
    getOlderChatMessages: (id: string, beforeId: string) => getOlderChatMessagesAdmin(id, beforeId),
    getChatContactHistory: (id: string) => getChatContactHistoryAdmin(id),
    sendMessage: (id: string, text: string, note?: boolean) => sendMessageAdmin(id, text, note),
    sendMediaMessage: (id: string, formData: FormData) => sendMediaMessageAdmin(id, formData),
    updateConversationTags: (id: string, tags: string[]) => updateConversationTagsAdmin(id, tags),
    updateConversationFunnelStage: (id: string, stage: FunnelStage) => updateConversationFunnelStageAdmin(id, stage),
    assignConversationToUser: (id: string, userId: string | null) => assignConversationToUserAdmin(id, userId),
    resolveConversation: (id: string, data?: { reason: string; notes?: string }) => resolveConversationAdmin(id, data),
    reopenConversation: (id: string) => reopenConversationAdmin(id),
    listCannedResponses: () => listCannedResponsesAdmin(),
    createCannedResponse: (shortcut: string, content: string) => createCannedResponseAdmin(shortcut, content),
    suggestIaReply: (id: string) => suggestIaReplyAdmin(id),
  },
};

interface ChatCrmAppProps {
  scope: Scope;
  basePath: string;
  view: View;
}

export function ChatCrmApp({ scope, basePath, view }: ChatCrmAppProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actions = ACTIONS_BY_SCOPE[scope];

  const [filterTab, setFilterTab] = useState<InboxFilter>("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [quickReplies, setQuickReplies] = useState<{ id: string; shortcut: string; content: string }[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(searchParams.get("c"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);

  const totalUnreadRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  const [attendantCapacity, setAttendantCapacity] = useState<{ activeCount: number; maxLimit: number } | null>(null);
  const [availableClinics, setAvailableClinics] = useState<{ id: string; tradeName: string }[]>([]);

  const refreshContacts = useCallback(async () => {
    const capacityFn = scope === "admin" ? getAttendantCapacityAdmin : getAttendantCapacity;
    capacityFn().then(setAttendantCapacity).catch(() => {});

    const result =
      view === "crm"
        ? (
            await Promise.all([
              actions.listChatContacts("todas", searchQuery || undefined),
              actions.listChatContacts("finalizadas", searchQuery || undefined),
            ])
          ).flat()
        : await actions.listChatContacts(filterTab, searchQuery || undefined);
    setContacts(result);

    const totalUnread = result.reduce((sum, item) => sum + item.unreadCount, 0);
    updateTabTitleUnreadCount(totalUnread);

    if (!isFirstLoadRef.current && totalUnread > totalUnreadRef.current) {
      playNotificationSound();
      const unreadContact = result.find((c) => c.unreadCount > 0);
      if (unreadContact) {
        showDesktopNotification(`💬 Nova mensagem de ${unreadContact.name}`, {
          body: unreadContact.lastMessage,
          onClick: () => setSelectedContactId(unreadContact.id),
        });
      }
    }
    totalUnreadRef.current = totalUnread;
    isFirstLoadRef.current = false;

    setSelectedContactId((current) => {
      if (current && result.some((c) => c.id === current)) return current;
      return result[0]?.id ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, filterTab, searchQuery, scope, view]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  const refreshQuickReplies = useCallback(async () => {
    const responses = await actions.listCannedResponses();
    setQuickReplies(responses.map((r) => ({ id: r.id, shortcut: r.shortcut, content: r.content })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  useEffect(() => {
    actions.listChatAgents().then(setAgents);
    refreshQuickReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  async function handleSaveQuickReply(shortcut: string, content: string) {
    await actions.createCannedResponse(shortcut, content);
    await refreshQuickReplies();
  }

  useEffect(() => {
    // Reatribuição de clínica só faz sentido pra quem enxerga todas (admin) — a
    // clínica só vê a própria conversa, não teria pra onde transferir.
    if (scope === "admin") {
      listClinicsForReassignment().then(setAvailableClinics).catch(() => {});
    }
  }, [scope]);

  async function handleReassignClinic(clinicId: string) {
    if (!selectedContactId) return;
    try {
      await updateConversationClinicAdmin(selectedContactId, clinicId);
      toast.success("Clínica da conversa atualizada com sucesso!");
      await refreshContacts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível trocar a clínica.");
    }
  }

  /** scope=admin exige escolher a clínica (ele não está preso a uma só); scope=clinic
   * usa sempre a da sessão logada — por isso não dá pra passar isso por `actions`
   * genérico, as duas versões têm assinaturas diferentes. */
  async function handleCreateContact(name: string, phone: string, clinicId?: string) {
    const conversationId =
      scope === "admin" ? await createContactAdmin(name, phone, clinicId ?? "") : await createContact(name, phone);
    await refreshContacts();
    selectContact(conversationId);
  }

  const refreshMessages = useCallback(async () => {
    if (!selectedContactId) {
      setMessages([]);
      setHasMoreMessages(false);
      return;
    }
    // As duas chamadas são independentes (mensagens vs. histórico de agendamentos
    // do contato) — rodar em paralelo evita pagar 2x a latência de rede/DB por ciclo.
    const [{ messages: result, hasMore }, history] = await Promise.all([
      actions.getChatMessages(selectedContactId),
      actions.getChatContactHistory(selectedContactId),
    ]);
    setMessages((prev) => {
      // O polling só traz a página mais recente (MESSAGE_PAGE_SIZE mensagens) —
      // preserva quaisquer mensagens mais antigas já carregadas via "Carregar
      // mensagens anteriores" em vez de descartá-las a cada ciclo.
      const incomingIds = new Set(result.map((message) => message.id));
      const olderAlreadyLoaded = prev.filter((message) => !incomingIds.has(message.id) && !message.id.startsWith("temp-"));

      // O polling gera uma URL assinada NOVA a cada ciclo pro mesmo arquivo de
      // mídia (o conteúdo nunca muda depois de criado) — se a `src` do <audio>/
      // <img> troca no meio de uma reprodução, o navegador reinicia a mídia do
      // zero. Mantém a URL já carregada em vez de trocar por outra igualmente
      // válida a cada 5s.
      const prevById = new Map(prev.map((message) => [message.id, message]));
      const latestPage = result.map((message) => {
        const existing = prevById.get(message.id);
        return existing?.mediaUrl && message.mediaUrl
          ? { ...message, mediaUrl: existing.mediaUrl }
          : message;
      });
      return [...olderAlreadyLoaded, ...latestPage];
    });
    setHasMoreMessages(hasMore);
    setContacts((prev) =>
      prev.map((c) => (c.id === selectedContactId ? { ...c, consultationHistory: history } : c))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, selectedContactId]);

  // Limpa a conversa anterior antes de carregar a nova — sem isso, o merge de
  // "preserva mensagens antigas já carregadas" do refreshMessages acima juntaria
  // mensagens da conversa ANTERIOR com a nova, por um ciclo, ao trocar de contato.
  useEffect(() => {
    setMessages([]);
    setHasMoreMessages(false);
  }, [selectedContactId]);

  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

  async function handleLoadOlderMessages() {
    if (!selectedContactId || messages.length === 0 || isLoadingOlderMessages) return;
    setIsLoadingOlderMessages(true);
    try {
      const oldestId = messages[0].id;
      const { messages: older, hasMore } = await actions.getOlderChatMessages(selectedContactId, oldestId);
      setMessages((prev) => [...older, ...prev]);
      setHasMoreMessages(hasMore);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }

  useInboxRealtime(() => {
    refreshContacts();
    refreshMessages();
  });

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;

  function selectContact(id: string) {
    setSelectedContactId(id);
    router.replace(`${basePath}/inbox?c=${id}`);
  }

  async function handleSendMessage(text: string, mode: "whatsapp" | "internal_note") {
    if (!selectedContactId) return;

    const tempId = `temp-${Date.now()}`;
    const nowTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());

    const optimisticMsg: Message = {
      id: tempId,
      sender: "agent",
      senderName: "Você",
      text,
      timestamp: nowTime,
      type: mode === "internal_note" ? "internal_note" : "text",
    };

    // 0ms Latência: Renderiza o balão de mensagem e atualiza o card do contato instantaneamente
    setMessages((prev) => [...prev, optimisticMsg]);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContactId ? { ...c, lastMessage: text, lastMessageTime: nowTime } : c
      )
    );

    try {
      await actions.sendMessage(selectedContactId, text, mode === "internal_note");
      refreshMessages();
      refreshContacts();
    } catch {
      toast.error("Erro ao enviar mensagem.");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  }

  async function handleSendMedia(file: File) {
    if (!selectedContactId) return;

    const tempId = `temp-${Date.now()}`;
    const nowTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    const isImage = file.type.startsWith("image/");
    // Preview local instantâneo (0ms) via blob do próprio arquivo — trocado
    // pela URL assinada de verdade assim que o upload/refreshMessages volta.
    const localPreviewUrl = URL.createObjectURL(file);

    const optimisticMsg: Message = {
      id: tempId,
      sender: "agent",
      senderName: "Você",
      timestamp: nowTime,
      type: "attachment",
      attachmentName: file.name,
      attachmentSize: formatFileSize(file.size),
      mediaUrl: localPreviewUrl,
      mimeType: file.type,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContactId
          ? { ...c, lastMessage: isImage ? "📷 Imagem" : "📄 Documento", lastMessageTime: nowTime }
          : c
      )
    );

    try {
      const formData = new FormData();
      formData.append("file", file);
      await actions.sendMediaMessage(selectedContactId, formData);
      await refreshMessages();
      refreshContacts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar arquivo.");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      URL.revokeObjectURL(localPreviewUrl);
    }
  }

  async function handleAddTag(tag: string) {
    if (!selectedContact) return;
    await actions.updateConversationTags(selectedContact.id, [...selectedContact.tags, tag]);
    await refreshContacts();
  }

  async function handleRemoveTag(tag: string) {
    if (!selectedContact) return;
    await actions.updateConversationTags(selectedContact.id, selectedContact.tags.filter((t) => t !== tag));
    await refreshContacts();
  }

  async function handleUpdateFunnelStage(stage: FunnelStage) {
    if (!selectedContactId) return;
    await actions.updateConversationFunnelStage(selectedContactId, stage);
    await refreshContacts();
  }

  async function handleMoveStage(contactId: string, stage: FunnelStage) {
    await actions.updateConversationFunnelStage(contactId, stage);
    await refreshContacts();
  }

  async function handleFinish(contactId: string) {
    await actions.resolveConversation(contactId);
    await refreshContacts();
  }

  async function handleReopen(contactId: string) {
    await actions.reopenConversation(contactId);
    await refreshContacts();
  }

  async function handleFinishAttendance(resolutionData?: { reason: string; notes?: string }) {
    if (!selectedContactId) return;
    await actions.resolveConversation(selectedContactId, resolutionData);
    toast.success("Atendimento finalizado com sucesso!");
    await refreshContacts();
  }

  const fetchDoctors = useCallback(async () => {
    if (scope === "admin") {
      if (!selectedContact?.clinicId) return [];
      return listClinicDoctorsForAppointmentAdmin(selectedContact.clinicId);
    }
    return listClinicDoctorsForAppointment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, selectedContact?.clinicId]);

  const fetchProcedures = useCallback(async () => {
    if (scope === "admin") {
      if (!selectedContact?.clinicId) return [];
      return listClinicProceduresForAppointmentAdmin(selectedContact.clinicId);
    }
    return listClinicProceduresForAppointment();
  }, [scope, selectedContact?.clinicId]);

  async function handleScheduleConfirmed(data: {
    appointmentId: string;
    specialty: string;
    doctor: string;
    date: string;
    time: string;
    price: string;
  }) {
    if (!selectedContactId) return;
    // Agendamentos gravados no sistema hospitalar da Santa Clara (via bridge) não têm
    // guia/QR Code no Postgres do Conecta Saúde — não faz sentido mandar esse link.
    const isBridgeAppointment = data.appointmentId.startsWith("bridge:");
    const guideLine = isBridgeAppointment
      ? ""
      : `\n\n📎 Guia com QR Code enviada ao paciente pelo WhatsApp: ${window.location.origin}/comprovante/${data.appointmentId}`;
    await actions.sendMessage(
      selectedContactId,
      `✅ Consulta confirmada!\n${data.specialty} — ${data.doctor}\nData: ${data.date} às ${data.time}\nValor: ${data.price}${guideLine}`,
      true
    );
    await handleUpdateFunnelStage("agendado");
    await refreshMessages();
  }

  async function handleClaimConversation() {
    if (!selectedContactId) return;
    const claimFn = scope === "admin" ? claimConversationAdmin : claimConversation;
    const result = await claimFn(selectedContactId);
    if (!result.success) {
      toast.error(result.message || "Não foi possível assumir a conversa.");
    } else {
      toast.success("Atendimento assumido por você com sucesso!");
      await refreshContacts();
      await refreshMessages();
    }
  }

  async function handleTransferAgent(agentId: string) {
    if (!selectedContactId) return;
    const transferFn = scope === "admin" ? transferConversationAdmin : transferConversation;
    const result = await transferFn(selectedContactId, agentId);
    if (!result.success) {
      toast.error((result as { success: boolean; message?: string }).message || "Não foi possível transferir.");
    } else {
      toast.success("Conversa transferida com sucesso!");
      await refreshContacts();
      await refreshMessages();
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col overflow-hidden">
      {view === "inbox" ? (
        <InboxLayout
          contacts={contacts}
          agents={agents}
          messages={messages}
          hasMoreMessages={hasMoreMessages}
          isLoadingOlderMessages={isLoadingOlderMessages}
          onLoadOlderMessages={handleLoadOlderMessages}
          attendantCapacity={attendantCapacity}
          selectedContactId={selectedContactId}
          onSelectContact={selectContact}
          filterTab={filterTab}
          onFilterTabChange={setFilterTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          quickReplies={quickReplies}
          onSaveQuickReply={handleSaveQuickReply}
          onSendMessage={handleSendMessage}
          onSendMedia={handleSendMedia}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onUpdateFunnelStage={handleUpdateFunnelStage}
          onClaimConversation={handleClaimConversation}
          onTransferAgent={handleTransferAgent}
          availableClinics={scope === "admin" ? availableClinics : undefined}
          onReassignClinic={scope === "admin" ? handleReassignClinic : undefined}
          onCreateContact={handleCreateContact}
          onFinishAttendance={handleFinishAttendance}
          fetchProcedures={fetchProcedures}
          fetchDoctors={fetchDoctors}
          onScheduleConfirmed={handleScheduleConfirmed}
          onSuggestIaReply={async () => {
            if (!selectedContactId) return "";
            return actions.suggestIaReply(selectedContactId);
          }}
        />
      ) : (
        <CRMKanban
          contacts={contacts}
          agents={agents}
          onMoveStage={handleMoveStage}
          onFinish={handleFinish}
          onReopen={handleReopen}
          onOpenContactChat={(id) => {
            router.push(`${basePath}/inbox?c=${id}`);
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  listChatContacts,
  listChatAgents,
  getChatMessages,
  getChatContactHistory,
  sendMessage,
  updateConversationTags,
  updateConversationFunnelStage,
  assignConversationToUser,
  claimConversation,
  transferConversation,
  resolveConversation,
  reopenConversation,
  listCannedResponses,
  listClinicProceduresForAppointment,
  suggestIaReply,
} from "@/actions/inbox";
import {
  listChatContactsAdmin,
  listChatAgentsAdmin,
  getChatMessagesAdmin,
  getChatContactHistoryAdmin,
  sendMessageAdmin,
  updateConversationTagsAdmin,
  updateConversationFunnelStageAdmin,
  assignConversationToUserAdmin,
  claimConversationAdmin,
  transferConversationAdmin,
  resolveConversationAdmin,
  reopenConversationAdmin,
  listCannedResponsesAdmin,
  listClinicProceduresForAppointmentAdmin,
  suggestIaReplyAdmin,
} from "@/actions/admin-inbox";
import { toast } from "sonner";
import { useInboxRealtime } from "@/hooks/use-inbox-realtime";
import { playNotificationSound } from "@/lib/notification-sound";
import { InboxLayout } from "./inbox-layout";
import { CRMKanban } from "./crm-kanban";
import type { Agent, Contact, FunnelStage, InboxFilter, Message } from "@/types/chat-crm";

type Scope = "clinic" | "admin";
type View = "inbox" | "crm";

const ACTIONS_BY_SCOPE = {
  clinic: {
    listChatContacts,
    listChatAgents,
    getChatMessages,
    getChatContactHistory,
    sendMessage,
    updateConversationTags,
    updateConversationFunnelStage,
    assignConversationToUser,
    resolveConversation,
    reopenConversation,
    listCannedResponses,
    suggestIaReply,
  },
  admin: {
    listChatContacts: listChatContactsAdmin,
    listChatAgents: listChatAgentsAdmin,
    getChatMessages: getChatMessagesAdmin,
    getChatContactHistory: getChatContactHistoryAdmin,
    sendMessage: sendMessageAdmin,
    updateConversationTags: updateConversationTagsAdmin,
    updateConversationFunnelStage: updateConversationFunnelStageAdmin,
    assignConversationToUser: assignConversationToUserAdmin,
    resolveConversation: resolveConversationAdmin,
    reopenConversation: reopenConversationAdmin,
    listCannedResponses: listCannedResponsesAdmin,
    suggestIaReply: suggestIaReplyAdmin,
  },
} as const;

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

  const totalUnreadRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  const refreshContacts = useCallback(async () => {
    // O Kanban de CRM não tem abas de filtro próprias — sempre mostra todas as
    // conversas (ativas + finalizadas, para a coluna "Finalizado" funcionar),
    // independente da aba selecionada na Caixa de Entrada. "todas" sozinho não
    // basta porque, na Caixa de Entrada, ele deliberadamente exclui as resolvidas.
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
    if (!isFirstLoadRef.current && totalUnread > totalUnreadRef.current) {
      playNotificationSound();
    }
    totalUnreadRef.current = totalUnread;
    isFirstLoadRef.current = false;

    setSelectedContactId((current) => {
      if (current && result.some((c) => c.id === current)) return current;
      return result[0]?.id ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, filterTab, searchQuery]);

  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  useEffect(() => {
    actions.listChatAgents().then(setAgents);
    actions.listCannedResponses().then((responses) =>
      setQuickReplies(responses.map((r) => ({ id: r.id, shortcut: r.shortcut, content: r.content })))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  const refreshMessages = useCallback(async () => {
    if (!selectedContactId) {
      setMessages([]);
      return;
    }
    const result = await actions.getChatMessages(selectedContactId);
    setMessages(result);

    const history = await actions.getChatContactHistory(selectedContactId);
    setContacts((prev) =>
      prev.map((c) => (c.id === selectedContactId ? { ...c, consultationHistory: history } : c))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, selectedContactId]);

  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

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
    await actions.sendMessage(selectedContactId, text, mode === "internal_note");
    await refreshMessages();
    await refreshContacts();
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

  async function handleFinishAttendance() {
    if (!selectedContactId) return;
    await actions.resolveConversation(selectedContactId);
    await refreshContacts();
  }

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
    const guideLink = `${window.location.origin}/comprovante/${data.appointmentId}`;
    await actions.sendMessage(
      selectedContactId,
      `✅ Consulta confirmada!\n${data.specialty} — ${data.doctor}\nData: ${data.date} às ${data.time}\nValor: ${data.price}\n\n📎 Guia com QR Code enviada ao paciente pelo WhatsApp: ${guideLink}`,
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
      toast.error(result.message);
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
      toast.error(result.message);
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
          selectedContactId={selectedContactId}
          onSelectContact={selectContact}
          filterTab={filterTab}
          onFilterTabChange={setFilterTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          quickReplies={quickReplies}
          onSendMessage={handleSendMessage}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onUpdateFunnelStage={handleUpdateFunnelStage}
          onClaimConversation={handleClaimConversation}
          onTransferAgent={handleTransferAgent}
          onFinishAttendance={handleFinishAttendance}
          fetchProcedures={fetchProcedures}
          onScheduleConfirmed={handleScheduleConfirmed}
          onSuggestIaReply={async () => {
            if (!selectedContactId) return "";
            return actions.suggestIaReply(selectedContactId);
          }}
        />
      ) : (
        <CRMKanban
          contacts={contacts}
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

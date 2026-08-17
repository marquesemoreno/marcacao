"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, KanbanSquare } from "lucide-react";
import {
  listChatContacts,
  listChatAgents,
  getChatMessages,
  getChatContactHistory,
  sendMessage,
  updateConversationTags,
  updateConversationFunnelStage,
  assignConversationToUser,
  resolveConversation,
  listCannedResponses,
} from "@/actions/inbox";
import { useInboxRealtime } from "@/hooks/use-inbox-realtime";
import { playNotificationSound } from "@/lib/notification-sound";
import { InboxLayout } from "./inbox-layout";
import { CRMKanban } from "./crm-kanban";
import type { Agent, Contact, FunnelStage, InboxFilter, Message } from "@/types/chat-crm";

type View = "inbox" | "crm";

export function ChatCrmApp() {
  const [view, setView] = useState<View>("inbox");
  const [filterTab, setFilterTab] = useState<InboxFilter>("minhas");
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [quickReplies, setQuickReplies] = useState<{ id: string; shortcut: string; content: string }[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const totalUnreadRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  const refreshContacts = useCallback(async () => {
    const result = await listChatContacts(filterTab, searchQuery || undefined);
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
  }, [filterTab, searchQuery]);

  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  useEffect(() => {
    listChatAgents().then(setAgents);
    listCannedResponses().then((responses) =>
      setQuickReplies(responses.map((r) => ({ id: r.id, shortcut: r.shortcut, content: r.content })))
    );
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!selectedContactId) {
      setMessages([]);
      return;
    }
    const result = await getChatMessages(selectedContactId);
    setMessages(result);

    const history = await getChatContactHistory(selectedContactId);
    setContacts((prev) =>
      prev.map((c) => (c.id === selectedContactId ? { ...c, consultationHistory: history } : c))
    );
  }, [selectedContactId]);

  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

  useInboxRealtime(() => {
    refreshContacts();
    refreshMessages();
  });

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;

  async function handleSendMessage(text: string, mode: "whatsapp" | "internal_note") {
    if (!selectedContactId) return;
    await sendMessage(selectedContactId, text, mode === "internal_note");
    await refreshMessages();
    await refreshContacts();
  }

  async function handleAddTag(tag: string) {
    if (!selectedContact) return;
    await updateConversationTags(selectedContact.id, [...selectedContact.tags, tag]);
    await refreshContacts();
  }

  async function handleRemoveTag(tag: string) {
    if (!selectedContact) return;
    await updateConversationTags(selectedContact.id, selectedContact.tags.filter((t) => t !== tag));
    await refreshContacts();
  }

  async function handleUpdateFunnelStage(stage: FunnelStage) {
    if (!selectedContactId) return;
    await updateConversationFunnelStage(selectedContactId, stage);
    await refreshContacts();
  }

  async function handleMoveStage(contactId: string, stage: FunnelStage) {
    await updateConversationFunnelStage(contactId, stage);
    await refreshContacts();
  }

  async function handleTransferAgent(agentId: string) {
    if (!selectedContactId) return;
    await assignConversationToUser(selectedContactId, agentId);
    await refreshContacts();
  }

  async function handleFinishAttendance() {
    if (!selectedContactId) return;
    await resolveConversation(selectedContactId);
    await refreshContacts();
  }

  async function handleScheduleConfirmed(data: {
    specialty: string;
    doctor: string;
    date: string;
    time: string;
    price: string;
  }) {
    if (!selectedContactId) return;
    await sendMessage(
      selectedContactId,
      `✅ Consulta confirmada!\n${data.specialty} — ${data.doctor}\nData: ${data.date} às ${data.time}\nValor: ${data.price}`,
      true
    );
    await handleUpdateFunnelStage("agendado");
    await refreshMessages();
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-2 shrink-0">
        <button
          onClick={() => setView("inbox")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === "inbox" ? "bg-emerald-100 text-emerald-800" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Caixa de Entrada
        </button>
        <button
          onClick={() => setView("crm")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === "crm" ? "bg-emerald-100 text-emerald-800" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <KanbanSquare className="h-3.5 w-3.5" />
          CRM (Funil de Leads)
        </button>
      </div>

      {view === "inbox" ? (
        <InboxLayout
          contacts={contacts}
          agents={agents}
          messages={messages}
          selectedContactId={selectedContactId}
          onSelectContact={setSelectedContactId}
          filterTab={filterTab}
          onFilterTabChange={setFilterTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          quickReplies={quickReplies}
          onSendMessage={handleSendMessage}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onUpdateFunnelStage={handleUpdateFunnelStage}
          onTransferAgent={handleTransferAgent}
          onFinishAttendance={handleFinishAttendance}
          onScheduleConfirmed={handleScheduleConfirmed}
        />
      ) : (
        <CRMKanban
          contacts={contacts}
          onMoveStage={handleMoveStage}
          onOpenContactChat={(id) => {
            setSelectedContactId(id);
            setView("inbox");
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CannedResponse } from "@prisma/client";
import {
  listConversations,
  getConversation,
  sendMessage,
  assignConversationToMe,
  resolveConversation,
  reopenConversation,
  updateConversationTags,
  listCannedResponses,
  markConversationRead,
} from "@/actions/inbox";
import { useInboxRealtime } from "@/hooks/use-inbox-realtime";
import { playNotificationSound } from "@/lib/notification-sound";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { ContactPanel } from "./contact-panel";
import type { ConversationFilter } from "@/lib/schemas/inbox";
import type { ConversationDetail, ConversationListItem } from "./types";

export function InboxApp() {
  const [filter, setFilter] = useState<ConversationFilter>("mine");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);

  const totalUnreadRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  const refreshList = useCallback(async () => {
    const result = await listConversations(filter, search || undefined);
    setConversations(result);

    const totalUnread = result.reduce((sum, item) => sum + item.unreadCount, 0);
    if (!isFirstLoadRef.current && totalUnread > totalUnreadRef.current) {
      playNotificationSound();
    }
    totalUnreadRef.current = totalUnread;
    isFirstLoadRef.current = false;
  }, [filter, search]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    listCannedResponses().then(setCannedResponses);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedConversation(null);
      return;
    }
    let cancelled = false;
    getConversation(selectedId).then((detail) => {
      if (!cancelled) setSelectedConversation(detail);
    });
    markConversationRead(selectedId).then(() => refreshList());
    return () => {
      cancelled = true;
    };
    // refreshList intentionally omitted: only re-run when the selected conversation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const pollSelected = useCallback(async () => {
    if (!selectedId) return;
    const detail = await getConversation(selectedId);
    setSelectedConversation(detail);
  }, [selectedId]);

  useInboxRealtime(() => {
    refreshList();
    pollSelected();
  });

  async function handleSendMessage(content: string) {
    if (!selectedId) return;
    await sendMessage(selectedId, content);
    await pollSelected();
    await refreshList();
  }

  async function handleUpdateTags(tags: string[]) {
    if (!selectedId) return;
    await updateConversationTags(selectedId, tags);
    await pollSelected();
  }

  async function handleAssignToMe() {
    if (!selectedId) return;
    await assignConversationToMe(selectedId);
    await pollSelected();
    await refreshList();
  }

  async function handleResolve() {
    if (!selectedId) return;
    await resolveConversation(selectedId);
    await pollSelected();
    await refreshList();
  }

  async function handleReopen() {
    if (!selectedId) return;
    await reopenConversation(selectedId);
    await pollSelected();
    await refreshList();
  }

  return (
    <div className="grid h-full grid-cols-1 overflow-hidden rounded-lg border md:grid-cols-[300px_1fr] lg:grid-cols-[300px_1fr_300px]">
      <div className={selectedId ? "hidden md:block" : "block"}>
        <ConversationList
          conversations={conversations}
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={setSearch}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <div className={selectedId ? "block" : "hidden md:block"}>
        <ChatWindow
          conversation={selectedConversation}
          cannedResponses={cannedResponses}
          onSendMessage={handleSendMessage}
          onResolve={handleResolve}
          onReopen={handleReopen}
          onAssignToMe={handleAssignToMe}
        />
      </div>
      <div className="hidden lg:block">
        {selectedConversation ? (
          <ContactPanel conversation={selectedConversation} onUpdateTags={handleUpdateTags} />
        ) : (
          <div className="flex h-full items-center justify-center border-l text-xs text-muted-foreground">
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  );
}

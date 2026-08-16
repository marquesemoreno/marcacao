"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, CheckCircle2, RotateCcw, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageBubble } from "./message-bubble";
import { CannedResponseMenu } from "./canned-response-menu";
import { toast } from "sonner";
import type { CannedResponse } from "@prisma/client";
import type { ConversationDetail } from "./types";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function dateLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Hoje";
  if (sameDay(date, yesterday)) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export function ChatWindow({
  conversation,
  cannedResponses,
  onSendMessage,
  onResolve,
  onReopen,
  onAssignToMe,
}: {
  conversation: ConversationDetail | null;
  cannedResponses: CannedResponse[];
  onSendMessage: (content: string) => Promise<void>;
  onResolve: () => Promise<void>;
  onReopen: () => Promise<void>;
  onAssignToMe: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.messages.length]);

  useEffect(() => {
    setDraft("");
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground">
        Selecione uma conversa para começar.
      </div>
    );
  }

  const showCannedMenu = draft.startsWith("/");
  const cannedQuery = showCannedMenu ? draft.slice(1) : "";

  async function handleSend() {
    const content = draft.trim();
    if (!content || isSending) return;
    setIsSending(true);
    try {
      await onSendMessage(content);
      setDraft("");
    } catch {
      toast.error("Não foi possível enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  let lastDateKey = "";

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initials(conversation.contact.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{conversation.contact.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {conversation.contact.phone}
              {conversation.assignedUser ? ` · Atendente: ${conversation.assignedUser.name}` : " · Sem atendente"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {!conversation.assignedUser && (
            <Button variant="outline" size="sm" onClick={() => onAssignToMe()}>
              <UserPlus className="h-4 w-4" />
              Atribuir a mim
            </Button>
          )}
          {conversation.status === "RESOLVED" ? (
            <Button variant="outline" size="sm" onClick={() => onReopen()}>
              <RotateCcw className="h-4 w-4" />
              Reabrir
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onResolve()}>
              <CheckCircle2 className="h-4 w-4" />
              Finalizar Atendimento
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="flex-1 bg-muted/30 p-3">
        <div className="flex flex-col gap-2">
          {conversation.messages.map((message) => {
            const dateKey = new Date(message.createdAt).toDateString();
            const showSeparator = dateKey !== lastDateKey;
            lastDateKey = dateKey;
            return (
              <div key={message.id} className="flex flex-col gap-2">
                {showSeparator && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
                      {dateLabel(new Date(message.createdAt))}
                    </span>
                  </div>
                )}
                <MessageBubble message={message} />
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="relative border-t p-3">
        {showCannedMenu && cannedResponses.length > 0 && (
          <CannedResponseMenu
            responses={cannedResponses}
            query={cannedQuery}
            onSelect={(response) => setDraft(response.content)}
          />
        )}
        <div className="flex items-end gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toast.info("Envio de anexos ainda não implementado.")}
                />
              }
            >
              <Paperclip className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Anexar arquivo (em breve)</TooltipContent>
          </Tooltip>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Digite uma mensagem ou / para respostas rápidas"
            className="max-h-32 min-h-10 flex-1 resize-none"
            rows={1}
          />
          <Button onClick={handleSend} disabled={isSending || !draft.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

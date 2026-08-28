"use client";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ConversationFilter } from "@/lib/schemas/inbox";
import type { ConversationListItem } from "./types";

const filterLabels: Record<ConversationFilter, string> = {
  mine: "Minhas",
  unassigned: "Não Atribuídas",
  all: "Todas",
  resolved: "Finalizadas",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

export function ConversationList({
  conversations,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  selectedId,
  onSelect,
}: {
  conversations: ConversationListItem[];
  filter: ConversationFilter;
  onFilterChange: (filter: ConversationFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col border-r">
      <div className="space-y-2 border-b p-3">
        <Tabs value={filter} onValueChange={(value) => onFilterChange(value as ConversationFilter)}>
          <TabsList className="w-full">
            {(Object.keys(filterLabels) as ConversationFilter[]).map((key) => (
              <TabsTrigger key={key} value={key} className="flex-1 text-xs">
                {filterLabels[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="h-9"
        />
      </div>

      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa por aqui.</p>
        ) : (
          <div className="flex flex-col">
            {conversations.map((conversation) => {
              const lastMessage = conversation.messages[0];
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    "flex items-start gap-3 border-b p-3 text-left transition-colors hover:bg-accent",
                    selectedId === conversation.id && "bg-accent"
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>{initials(conversation.contact.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{conversation.contact.name}</p>
                      {lastMessage && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatTime(lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {lastMessage?.content ?? "Sem mensagens ainda"}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                        <WhatsAppIcon className="h-2.5 w-2.5" />
                        WhatsApp
                      </Badge>
                      {conversation.unreadCount > 0 && (
                        <Badge className="h-4 min-w-4 justify-center px-1 text-[10px]">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

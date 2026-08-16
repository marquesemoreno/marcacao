import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageDirection, MessageStatus } from "@prisma/client";

export type MessageBubbleData = {
  id: string;
  direction: MessageDirection;
  content: string;
  status: MessageStatus;
  createdAt: Date | string;
  senderUser?: { name: string } | null;
};

function StatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case "PENDING":
      return <Clock className="h-3 w-3 text-white/70" />;
    case "SENT":
      return <Check className="h-3 w-3 text-white/70" />;
    case "DELIVERED":
      return <CheckCheck className="h-3 w-3 text-white/70" />;
    case "READ":
      return <CheckCheck className="h-3 w-3 text-sky-300" />;
    case "FAILED":
      return <AlertCircle className="h-3 w-3 text-destructive-foreground" />;
  }
}

export function MessageBubble({ message }: { message: MessageBubbleData }) {
  const isOutbound = message.direction === "OUTBOUND";
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(message.createdAt)
  );

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm",
          isOutbound
            ? "rounded-tr-none bg-emerald-600 text-white"
            : "rounded-tl-none border bg-card text-card-foreground"
        )}
      >
        {isOutbound && message.senderUser && (
          <p className="mb-0.5 text-xs font-semibold text-white/80">{message.senderUser.name}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            isOutbound ? "text-white/70" : "text-muted-foreground"
          )}
        >
          <span>{time}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

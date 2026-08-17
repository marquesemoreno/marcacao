import { ChatCrmApp } from "@/components/chat/chat-crm-app";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InboxPage() {
  return (
    <div className="h-full">
      <ChatCrmApp />
    </div>
  );
}

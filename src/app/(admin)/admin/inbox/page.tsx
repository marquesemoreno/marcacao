import { Suspense } from "react";
import { ChatCrmApp } from "@/components/chat/chat-crm-app";
import { getInboxRealtimeChannelName } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminInboxPage() {
  return (
    <div className="h-full min-h-0">
      <Suspense fallback={null}>
        <ChatCrmApp scope="admin" basePath="/admin" view="inbox" realtimeTopic={getInboxRealtimeChannelName()} />
      </Suspense>
    </div>
  );
}

import { Suspense } from "react";
import { ChatCrmApp } from "@/components/chat/chat-crm-app";
import { getInboxRealtimeChannelName } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCrmPage() {
  return (
    <div className="h-full">
      <Suspense fallback={null}>
        <ChatCrmApp scope="admin" basePath="/admin" view="crm" realtimeTopic={getInboxRealtimeChannelName()} />
      </Suspense>
    </div>
  );
}

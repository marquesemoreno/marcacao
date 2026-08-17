import { Suspense } from "react";
import { ChatCrmApp } from "@/components/chat/chat-crm-app";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCrmPage() {
  return (
    <div className="h-full">
      <Suspense fallback={null}>
        <ChatCrmApp scope="admin" basePath="/admin" view="crm" />
      </Suspense>
    </div>
  );
}

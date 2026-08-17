import { Suspense } from "react";
import { ChatCrmApp } from "@/components/chat/chat-crm-app";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ClinicCrmPage() {
  return (
    <div className="h-full">
      <Suspense fallback={null}>
        <ChatCrmApp scope="clinic" basePath="/clinic" view="crm" />
      </Suspense>
    </div>
  );
}

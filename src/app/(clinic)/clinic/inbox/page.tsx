import { Suspense } from "react";
import { ChatCrmApp } from "@/components/chat/chat-crm-app";
import { requireClinicSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InboxPage() {
  const { clinicId } = await requireClinicSession();
  return (
    <div className="h-full">
      <Suspense fallback={null}>
        <ChatCrmApp scope="clinic" basePath="/clinic" view="inbox" clinicId={clinicId} />
      </Suspense>
    </div>
  );
}

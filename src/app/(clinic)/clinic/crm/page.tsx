import { Suspense } from "react";
import { ChatCrmApp } from "@/components/chat/chat-crm-app";
import { requireClinicSession } from "@/lib/session";

export const metadata = { title: "CRM" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClinicCrmPage() {
  const { clinicId } = await requireClinicSession();
  return (
    <div className="h-full min-h-0">
      <Suspense fallback={null}>
        <ChatCrmApp scope="clinic" basePath="/clinic" view="crm" clinicId={clinicId} />
      </Suspense>
    </div>
  );
}

import { InboxApp } from "@/components/inbox/inbox-app";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InboxPage() {
  return (
    <div className="h-full">
      <InboxApp />
    </div>
  );
}

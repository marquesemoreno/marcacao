import { listChatAutomations } from "@/actions/chat-automations";
import { AutomationsManagement } from "@/components/admin/automations-management";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminAutomationsPage() {
  const automations = await listChatAutomations();

  return <AutomationsManagement automations={automations} />;
}

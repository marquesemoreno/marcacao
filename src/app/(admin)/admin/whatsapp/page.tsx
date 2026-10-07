import { listCloudAccounts } from "@/actions/admin-whatsapp-cloud";
import { WhatsappCloudConnect } from "@/components/admin/whatsapp-cloud-connect";

export const metadata = { title: "WhatsApp — API oficial" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminWhatsappCloudPage() {
  const rows = await listCloudAccounts();
  return <WhatsappCloudConnect rows={rows} />;
}

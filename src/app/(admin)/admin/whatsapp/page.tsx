import { listCloudAccounts } from "@/actions/admin-whatsapp-cloud";
import { WhatsappCloudConnect } from "@/components/admin/whatsapp-cloud-connect";
import { langFrom } from "@/lib/i18n-review";

export const metadata = { title: "WhatsApp — API oficial" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminWhatsappCloudPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const [rows, params] = await Promise.all([listCloudAccounts(), searchParams]);
  return <WhatsappCloudConnect rows={rows} lang={langFrom(params.lang)} />;
}

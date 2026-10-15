import { listCloudAssets } from "@/actions/admin-whatsapp-cloud";
import { CloudSendMessage } from "@/components/admin/cloud-send-message";
import { langFrom } from "@/lib/i18n-review";

export const metadata = { title: "WhatsApp — Send message" };
export const dynamic = "force-dynamic";

export default async function AdminCloudSendPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const [assets, params] = await Promise.all([listCloudAssets(), searchParams]);
  return <CloudSendMessage assets={assets} lang={langFrom(params.lang)} />;
}

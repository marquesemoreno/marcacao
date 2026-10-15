import { listCloudAssets } from "@/actions/admin-whatsapp-cloud";
import { CloudTemplates } from "@/components/admin/cloud-templates";
import { langFrom } from "@/lib/i18n-review";

export const metadata = { title: "WhatsApp — Message templates" };
export const dynamic = "force-dynamic";

export default async function AdminCloudTemplatesPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const [assets, params] = await Promise.all([listCloudAssets(), searchParams]);
  return <CloudTemplates assets={assets} lang={langFrom(params.lang)} />;
}

import { listCloudAssets } from "@/actions/admin-whatsapp-cloud";
import { CloudSendMessage } from "@/components/admin/cloud-send-message";
import { ManagerOnly, currentUserIsManager } from "@/components/clinic/manager-only";
import { langFrom } from "@/lib/i18n-review";

export const metadata = { title: "WhatsApp — Enviar" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  if (!(await currentUserIsManager())) return <ManagerOnly />;
  const [assets, params] = await Promise.all([listCloudAssets(), searchParams]);
  return (
    <div className="h-full overflow-y-auto">
      <CloudSendMessage assets={assets} lang={langFrom(params.lang)} base="/clinic/whatsapp" />
    </div>
  );
}

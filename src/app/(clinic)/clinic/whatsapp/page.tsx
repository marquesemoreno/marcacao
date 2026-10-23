import { listCloudAccounts } from "@/actions/admin-whatsapp-cloud";
import { WhatsappCloudConnect } from "@/components/admin/whatsapp-cloud-connect";
import { ManagerOnly, currentUserIsManager } from "@/components/clinic/manager-only";
import { langFrom } from "@/lib/i18n-review";

export const metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

/** API oficial do WhatsApp da própria clínica — só gestão (mesma tela do /admin/whatsapp,
 * restrita à clínica do usuário pelas actions). */
export default async function ClinicWhatsappPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  if (!(await currentUserIsManager())) return <ManagerOnly />;
  const [rows, params] = await Promise.all([listCloudAccounts(), searchParams]);
  return (
    <div className="h-full overflow-y-auto">
      <WhatsappCloudConnect rows={rows} lang={langFrom(params.lang)} base="/clinic/whatsapp" />
    </div>
  );
}

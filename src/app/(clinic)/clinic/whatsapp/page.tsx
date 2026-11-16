import { listCloudAccounts } from "@/actions/admin-whatsapp-cloud";
import { WhatsappCloudConnect } from "@/components/admin/whatsapp-cloud-connect";
import { ManagerOnly, currentUserIsManager } from "@/components/clinic/manager-only";
import { langFrom } from "@/lib/i18n-review";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { WhatsappQrCard } from "@/components/clinic/whatsapp-qr-card";

export const metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

/** API oficial do WhatsApp da própria clínica — só gestão (mesma tela do /admin/whatsapp,
 * restrita à clínica do usuário pelas actions). */
export default async function ClinicWhatsappPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  if (!(await currentUserIsManager())) return <ManagerOnly />;
  const [rows, params] = await Promise.all([listCloudAccounts(), searchParams]);
  return (
    <div className="soft-canvas h-full overflow-y-auto">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6 md:px-8 md:pt-8 max-w-5xl mx-auto w-full space-y-4">
        <Link href="/clinic/configuracoes" prefetch={false} className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Configurações
        </Link>
        <WhatsappQrCard />
        <h2 className="pt-2 text-base font-semibold text-slate-900 dark:text-slate-100">API oficial (Meta)</h2>
      </div>
      <WhatsappCloudConnect rows={rows} lang={langFrom(params.lang)} base="/clinic/whatsapp" />
    </div>
  );
}

import { listCloudAccounts } from "@/actions/admin-whatsapp-cloud";
import { WhatsappCloudConnect } from "@/components/admin/whatsapp-cloud-connect";
import { langFrom, t } from "@/lib/i18n-review";

/** Título da aba no idioma da tela (a gravação da análise da Meta é em inglês). */
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  return { title: t(langFrom((await searchParams).lang), "connect.pageTitle") };
}
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminWhatsappCloudPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const [rows, params] = await Promise.all([listCloudAccounts(), searchParams]);
  return <WhatsappCloudConnect rows={rows} lang={langFrom(params.lang)} />;
}

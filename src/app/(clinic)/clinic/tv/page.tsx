import { ManagerOnly, currentUserIsManager } from "@/components/clinic/manager-only";
import { PageHeader } from "@/components/clinic/page-header";
import { TvSettings } from "@/components/clinic/tv-settings";
import { getTickerSettings, getTvBackgroundSetting, getTvSettings, listTvMedia } from "@/actions/tv-call";
import { TvBackgroundSettings } from "@/components/clinic/tv-background-settings";
import { TvTickerSettings } from "@/components/clinic/tv-ticker-settings";
import { TvMediaSettings } from "@/components/clinic/tv-media-settings";
import { ArrivalFenceSettings } from "@/components/clinic/arrival-fence-settings";
import { getArrivalFence, listQueueServicesAdmin } from "@/actions/queue-ticket";
import { QueueServicesSettings } from "@/components/clinic/queue-services-settings";
import { getAgenda } from "@/actions/agenda";
import { todayInBahia } from "@/lib/agenda-ui";
import { addDays } from "@/lib/agenda";

export const metadata = { title: "TV da sala de espera" };
export const dynamic = "force-dynamic";

export default async function TvSettingsPage() {
  if (!(await currentUserIsManager())) return <ManagerOnly />;
  const today = todayInBahia();
  const [settings, agenda, media, fence, services, ticker, background] = await Promise.all([getTvSettings(), getAgenda(addDays(today, -7), addDays(today, 7)).catch(() => null), listTvMedia().catch(() => []), getArrivalFence(), listQueueServicesAdmin(), getTickerSettings(), getTvBackgroundSetting()]);
  // Médicos com agenda nas últimas/próximas 2 semanas (o nome vem igual ao da ponte).
  const doctors = [...new Set((agenda?.items ?? []).map((i) => i.doctor?.trim()).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <PageHeader
          title="TV da sala de espera"
          subtitle="Painel que mostra e anuncia em voz alta o paciente chamado. Abra o link da TV num mini PC, Raspberry ou no navegador da Smart TV."
        />
        <TvSettings initial={settings} doctors={doctors} />
        <QueueServicesSettings initial={services} />
        <ArrivalFenceSettings initial={fence} />
        <TvMediaSettings initial={media} />
        <TvTickerSettings initial={ticker} />
        <TvBackgroundSettings initial={background} />
      </div>
    </div>
  );
}

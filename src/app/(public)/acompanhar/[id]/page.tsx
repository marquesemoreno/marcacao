import type { Metadata } from "next";
import { getAppointmentByGuideLink } from "@/lib/appointment-read";
import { VoucherCard } from "@/components/public/voucher-card";
import { GuideLinkUnavailable } from "@/components/public/guide-link-unavailable";
import { toPlainAppointment } from "@/lib/serialize";
import { getBaseUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Sua guia | Conecta Saúde",
  robots: { index: false, follow: false },
};

type TrackingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { id } = await params;
  const res = await getAppointmentByGuideLink(id);
  if (res.state !== "OK") return <GuideLinkUnavailable expired={res.state === "EXPIRED"} />;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-center text-xl font-bold leading-tight">Sua guia de encaminhamento</h1>
      <VoucherCard
        appointment={toPlainAppointment(res.appointment)}
        comprovanteUrl={`${getBaseUrl()}/comprovante/${id}`}
      />
    </main>
  );
}

import { notFound } from "next/navigation";
import { getAppointmentById } from "@/lib/appointment-read";
import { VoucherCard } from "@/components/public/voucher-card";
import { toPlainAppointment } from "@/lib/serialize";
import { getBaseUrl } from "@/lib/format";

type TrackingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { id } = await params;
  const appointment = await getAppointmentById(id);

  if (!appointment) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-center text-xl font-bold leading-tight">Sua guia de encaminhamento</h1>
      <VoucherCard
        appointment={toPlainAppointment(appointment)}
        comprovanteUrl={`${getBaseUrl()}/comprovante/${appointment.id}`}
      />
    </main>
  );
}

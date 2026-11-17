import type { Metadata } from "next";
import { getAppointmentByGuideLink } from "@/lib/appointment-read";
import { VoucherCard } from "@/components/public/voucher-card";
import { GuideLinkUnavailable } from "@/components/public/guide-link-unavailable";
import { toPlainAppointment } from "@/lib/serialize";
import { getBaseUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Validar guia | Conecta Saúde",
  robots: { index: false, follow: false },
};

type ComprovantePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ComprovantePage({ params }: ComprovantePageProps) {
  const { id } = await params;
  const res = await getAppointmentByGuideLink(id);
  if (res.state !== "OK") return <GuideLinkUnavailable expired={res.state === "EXPIRED"} />;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-bold leading-tight text-slate-900">Validação de Guia</h1>
        <p className="text-sm text-slate-500">
          Conferência de autenticidade para a equipe da clínica.
        </p>
      </div>
      <VoucherCard
        appointment={toPlainAppointment(res.appointment)}
        comprovanteUrl={`${getBaseUrl()}/comprovante/${id}`}
        variant="validation"
      />
    </main>
  );
}

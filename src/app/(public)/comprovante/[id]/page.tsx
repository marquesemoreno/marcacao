import { notFound } from "next/navigation";
import { getAppointmentById } from "@/actions/appointments";
import { VoucherCard } from "@/components/public/voucher-card";
import { toPlainAppointment } from "@/lib/serialize";
import { getBaseUrl } from "@/lib/format";

export const metadata = {
  title: "Validar guia | Marcação",
};

type ComprovantePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ComprovantePage({ params }: ComprovantePageProps) {
  const { id } = await params;
  const appointment = await getAppointmentById(id);

  if (!appointment) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-bold leading-tight text-slate-900">Validação de Guia</h1>
        <p className="text-sm text-slate-500">
          Conferência de autenticidade para a equipe da clínica.
        </p>
      </div>
      <VoucherCard
        appointment={toPlainAppointment(appointment)}
        comprovanteUrl={`${getBaseUrl()}/comprovante/${appointment.id}`}
        variant="validation"
      />
    </main>
  );
}

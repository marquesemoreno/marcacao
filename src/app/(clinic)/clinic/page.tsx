import { CalendarDays, TrendingUp, Clock3, QrCode, CalendarX2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { getClinicOverview, listClinicAppointments } from "@/actions/clinic";
import { AppointmentActions } from "@/components/clinic/appointment-actions";
import { AvatarBadge } from "@/components/chat/avatar-badge";
import { buildWhatsAppLink } from "@/lib/format";
import { startOfUTCDay } from "@/lib/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusBadge: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pendente", className: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Confirmado", className: "bg-emerald-100 text-emerald-800" },
  COMPLETED: { label: "Realizado", className: "bg-sky-100 text-sky-800" },
  CANCELLED: { label: "Cancelado", className: "bg-rose-100 text-rose-800" },
  NO_SHOW: { label: "Falta", className: "bg-slate-200 text-slate-700" },
};

export default async function ClinicDashboardPage() {
  const [overview, appointments] = await Promise.all([
    getClinicOverview(),
    listClinicAppointments(),
  ]);

  const todayStart = startOfUTCDay(new Date()).toISOString();
  const todayAppointments = appointments.filter(
    (appointment) => appointment.date.toISOString() === todayStart
  );

  const kpis = [
    {
      label: "Agendamentos Hoje",
      value: overview.todayCount,
      icon: CalendarDays,
      iconBg: "bg-sky-50 text-sky-600",
    },
    {
      label: "Esta Semana",
      value: overview.weekCount,
      icon: TrendingUp,
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Aguardando Confirmação",
      value: overview.pendingCount,
      icon: Clock3,
      iconBg: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Início</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="flex items-center gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${kpi.iconBg}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {kpi.label}
                </p>
                <p className="text-3xl font-extrabold text-slate-900">{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Agenda de hoje</h2>
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          {todayAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                <CalendarX2 className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                Tudo tranquilo por aqui! Nenhum agendamento pendente para hoje.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Horário</th>
                    <th className="px-5 py-3">Paciente</th>
                    <th className="px-5 py-3">Procedimento</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayAppointments.map((appointment) => {
                    const badge = statusBadge[appointment.status];
                    return (
                      <tr key={appointment.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-slate-600">
                          {appointment.timeSlot ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <AvatarBadge name={appointment.patientName} size={32} />
                            <span className="font-medium text-slate-900">{appointment.patientName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {appointment.clinicProcedure.procedure.name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <AppointmentActions
                              appointmentId={appointment.id}
                              status={appointment.status}
                            />
                            <a
                              href={buildWhatsAppLink(
                                appointment.patientPhone,
                                `Olá ${appointment.patientName}, tudo bem? Aqui é da clínica, sobre seu agendamento de hoje.`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Chamar no WhatsApp"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                            <a
                              href={`/comprovante/${appointment.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver Guia com QR Code"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                              Guia
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

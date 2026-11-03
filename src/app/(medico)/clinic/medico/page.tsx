import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DoctorPanel } from "@/components/doctor/doctor-panel";
import { getMyPatientsToday } from "@/actions/agenda";
import { getDoctorRooms } from "@/actions/tv-call";
import { UserMenu } from "@/components/clinic/user-menu";
import { QueuePanel } from "@/components/clinic/queue-panel";
import { doctorKey } from "@/lib/tv-call";

export const metadata = { title: "Meus pacientes" };
export const dynamic = "force-dynamic";

/** Tela do login Médico (e de quem tem "chamar"): pacientes de hoje do médico ligado ao
 * login, com Chamar (TV) / Chamar de novo / Atendido. Layout próprio: o painel da equipe
 * usa ações que a função Médico não pode chamar. */
export default async function MedicoPage() {
  const session = await getServerSession(authOptions);
  let initial: Awaited<ReturnType<typeof getMyPatientsToday>> | null = null;
  let rooms: Awaited<ReturnType<typeof getDoctorRooms>> = [];
  try {
    [initial, rooms] = await Promise.all([getMyPatientsToday(), getDoctorRooms()]);
  } catch {
    initial = null;
  }
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold">Meus pacientes de hoje</p>
        <UserMenu userName={session?.user.name} subtitle="Médico" side="bottom" compact />
      </header>
      <main className="mx-auto max-w-2xl p-4">
        {initial ? (
          <>
            <DoctorPanel initial={initial} rooms={rooms} />
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-semibold">Senhas do totem</summary>
              <div className="mt-3">
                <QueuePanel
                  compact
                  defaultRoom={initial.doctorName ? rooms.find((r) => doctorKey(r.doctor) === doctorKey(initial.doctorName!))?.room ?? "" : ""}
                />
              </div>
            </details>
          </>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm dark:border-slate-800 dark:bg-slate-900">Seu login não tem acesso a esta tela.</p>
        )}
      </main>
    </div>
  );
}

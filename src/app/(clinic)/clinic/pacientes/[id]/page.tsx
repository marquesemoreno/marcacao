import { notFound } from "next/navigation";
import { getPatientProfile } from "@/actions/patient-profile";
import { PatientPage } from "@/components/clinic/patient-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Paciente" };

/** N1 — ficha do paciente (id = conversationId, mesma convenção do resto do painel). */
export default async function PacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPatientProfile(id);
  if (!profile) notFound();
  return <PatientPage profile={profile} />;
}

import { listClinics } from "@/actions/admin";
import { ClinicsManagement, type ClinicItem } from "@/components/admin/clinics-management";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminClinicsPage() {
  const clinics = await listClinics();

  return <ClinicsManagement clinics={clinics as unknown as ClinicItem[]} />;
}

import { listClinics } from "@/actions/admin";
import { BroadcastManagement } from "@/components/admin/broadcast-management";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminBroadcastPage() {
  const clinics = await listClinics();

  return (
    <BroadcastManagement clinics={clinics.map((c) => ({ id: c.id, tradeName: c.tradeName }))} />
  );
}

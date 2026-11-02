import { BroadcastManagement } from "@/components/clinic/broadcast-management";
import { ManagerOnly, currentUserCan } from "@/components/clinic/manager-only";

export const metadata = { title: "Disparos" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClinicBroadcastPage() {
  if (!(await currentUserCan("disparos"))) return <ManagerOnly />;
  return <BroadcastManagement />;
}

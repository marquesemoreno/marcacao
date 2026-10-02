import { BroadcastManagement } from "@/components/clinic/broadcast-management";

export const metadata = { title: "Disparos" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ClinicBroadcastPage() {
  return <BroadcastManagement />;
}

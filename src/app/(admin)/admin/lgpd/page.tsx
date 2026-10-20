import { listDeletionRecords } from "@/actions/admin-lgpd";
import { LgpdDeletion } from "@/components/admin/lgpd-deletion";

export const metadata = { title: "Exclusão de dados (LGPD)" };
export const dynamic = "force-dynamic";

export default async function AdminLgpdPage() {
  const records = await listDeletionRecords();
  return <LgpdDeletion records={records} />;
}

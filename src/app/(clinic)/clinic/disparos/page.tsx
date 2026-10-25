import { BroadcastManagement } from "@/components/clinic/broadcast-management";
import { ChannelBroadcastPanel } from "@/components/clinic/channel-broadcast-panel";

export const metadata = { title: "Disparos" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ClinicBroadcastPage() {
  return (
    <>
      <BroadcastManagement />
      <div className="px-4 pb-10 md:px-6">
        <ChannelBroadcastPanel />
      </div>
    </>
  );
}

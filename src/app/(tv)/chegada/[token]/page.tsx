import type { Metadata } from "next";
import { getTotemInfo } from "@/actions/queue-ticket";
import { TotemKiosk } from "@/components/totem/totem-kiosk";

export const metadata: Metadata = { title: "Cheguei — fila de atendimento", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** QR Code colado na recepção: o celular do paciente vira o totem (avisa que chegou / pega senha) e depois acompanha a fila em /senha/<token>. */
export default async function ChegadaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getTotemInfo(token, "QR");
  if (!info) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white p-8 text-center text-2xl text-slate-700 [color-scheme:light]">
        Este QR Code foi desligado. Retire a senha no balcão da recepção.
      </main>
    );
  }
  return <TotemKiosk token={token} clinicName={info.clinicName} print={false} mobile needsLocation={info.needsLocation} />;
}

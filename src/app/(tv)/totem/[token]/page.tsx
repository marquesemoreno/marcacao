import type { Metadata } from "next";
import { getTotemInfo } from "@/actions/queue-ticket";
import { TotemKiosk } from "@/components/totem/totem-kiosk";

export const metadata: Metadata = { title: "Retire sua senha", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Totem de senhas — abre sem login, só com o link gerado em /clinic/tv. */
export default async function TotemPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ imprimir?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const info = await getTotemInfo(token);
  if (!info) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white p-8 text-center text-2xl text-slate-700 [color-scheme:light]">
        Link do totem inválido ou desligado. Gere um novo em Configurações › TV da sala de espera.
      </main>
    );
  }
  return <TotemKiosk token={token} clinicName={info.clinicName} print={sp.imprimir !== "0"} />;
}

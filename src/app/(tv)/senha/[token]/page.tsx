import type { Metadata } from "next";
import { getTicketFollow } from "@/actions/queue-ticket";
import { TicketFollowView } from "@/components/totem/ticket-follow";

export const metadata: Metadata = { title: "Sua senha", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Página do QR Code impresso na senha: o paciente acompanha a posição na fila. */
export default async function SenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const follow = await getTicketFollow(token);
  if (!follow) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-6 text-center text-lg text-slate-700 [color-scheme:light]">
        Esta senha não vale mais (as senhas valem só no dia). Qualquer dúvida, fale com a recepção.
      </main>
    );
  }
  return <TicketFollowView token={token} initial={follow} />;
}

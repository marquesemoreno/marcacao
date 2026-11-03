import type { Metadata } from "next";
import { getTvState } from "@/actions/tv-call";
import { TvCallPanel } from "@/components/tv/tv-call-panel";

export const metadata: Metadata = { title: "Painel de chamada", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** TV da sala de espera — abre sem login, só com o link secreto gerado em /clinic/tv. */
export default async function TvPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getTvState(token);
  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 p-8 text-center text-2xl text-slate-300">
        Link da TV inválido ou desligado. Gere um novo em Configurações › TV da sala de espera.
      </main>
    );
  }
  return <TvCallPanel token={token} clinicName={state.clinicName} topic={state.topic} initialCalls={state.calls} />;
}

import { WaitingBoard } from "@/components/clinic/waiting-board";

export const metadata = { title: "Esperando" };
export const dynamic = "force-dynamic";

/** Quem está esperando resposta, quem está em atendimento e quantas conversas foram
 * finalizadas hoje — e o prazo da volta à fila (queue-return.ts). */
export default function WaitingPage() {
  return <WaitingBoard />;
}

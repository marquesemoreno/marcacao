import { AgendaApp } from "@/components/clinic/agenda/agenda-app";
import type { AgendaView } from "@/components/clinic/agenda/agenda-toolbar";
import { todayInBahia } from "@/lib/agenda-ui";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

const VIEWS: AgendaView[] = ["dia", "semana", "mes", "medico"];

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ data?: string; visao?: string }> }) {
  const params = await searchParams;
  const date = params.data && /^\d{4}-\d{2}-\d{2}$/.test(params.data) ? params.data : todayInBahia();
  const view = VIEWS.includes(params.visao as AgendaView) ? (params.visao as AgendaView) : "dia";
  return <AgendaApp initialDate={date} initialView={view} />;
}

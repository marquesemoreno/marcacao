import Link from "next/link";
import { AlertTriangle, CheckCircle2, MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/clinic/page-header";
import { listAiActions } from "@/actions/ai-actions";
import type { AiActionGroup } from "@/lib/ai-actions";

export const metadata = { title: "Ações da IA" };
export const dynamic = "force-dynamic";

const GROUPS: { id: AiActionGroup | "todas"; label: string }[] = [
  { id: "todas", label: "Tudo" },
  { id: "decisao", label: "Decisões sobre consultas" },
  { id: "atendimento", label: "Atendimento" },
];

const TONE_ICON = {
  positive: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden />,
  neutral: <MessageSquareText className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden />,
  attention: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden />,
} as const;

function whenLabel(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" });
}

export default async function AiActionsPage({ searchParams }: { searchParams: Promise<{ days?: string; grupo?: string; q?: string }> }) {
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const group = params.grupo === "decisao" || params.grupo === "atendimento" ? params.grupo : undefined;
  const query = params.q?.trim() || undefined;
  const rows = await listAiActions(days, { group, query });

  const href = (over: { days?: number; grupo?: string }) => {
    const sp = new URLSearchParams();
    sp.set("days", String(over.days ?? days));
    const g = over.grupo ?? group;
    if (g && g !== "todas") sp.set("grupo", g);
    if (query) sp.set("q", query);
    return `/clinic/ia?${sp.toString()}`;
  };
  const chip = (active: boolean) =>
    `inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
      active
        ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-4 md:p-6 max-w-4xl">
        <PageHeader
          title="Ações da IA"
          subtitle="O que a IA decidiu ou respondeu sozinha, com a mensagem do paciente que motivou. Abra a conversa para conferir ou corrigir."
        />

        <div className="flex flex-wrap items-center gap-2">
          {GROUPS.map((g) => (
            <Link key={g.id} href={href({ grupo: g.id })} className={chip((group ?? "todas") === g.id)} aria-current={(group ?? "todas") === g.id ? "true" : undefined}>
              {g.label}
            </Link>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
          {[7, 30, 90].map((d) => (
            <Link key={d} href={href({ days: d })} className={chip(days === d)} aria-current={days === d ? "true" : undefined}>
              {d} dias
            </Link>
          ))}
        </div>

        <form action="/clinic/ia" method="get" className="flex gap-2" role="search">
          <input type="hidden" name="days" value={days} />
          {group && <input type="hidden" name="grupo" value={group} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            aria-label="Buscar paciente"
            placeholder="Buscar paciente…"
            className="h-9 w-full max-w-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <button type="submit" className="h-9 rounded-lg px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
            Buscar
          </button>
        </form>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-600 dark:text-slate-400">
            Nenhuma ação da IA neste período. Quando ela confirmar, cancelar ou responder sozinha, aparece aqui.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/clinic/pacientes/${r.conversationId}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/50"
                >
                  <span className="mt-0.5">{TONE_ICON[r.tone]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                      {r.label} <span className="font-normal text-slate-500 dark:text-slate-400">· {r.patientName}</span>
                    </span>
                    <span className="block text-sm text-slate-600 dark:text-slate-300 break-words">{r.detail}</span>
                  </span>
                  <time dateTime={r.createdAt} className="shrink-0 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {whenLabel(r.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

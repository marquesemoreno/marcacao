import Link from "next/link";
import { AlertTriangle, CheckCircle2, MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/clinic/page-header";
import { getAfterHoursBookingSetting, getUrgencyTagSetting, listAiActions } from "@/actions/ai-actions";
import { UrgencyTagToggle } from "@/components/clinic/urgency-tag-toggle";
import { AfterHoursBookingToggle } from "@/components/clinic/after-hours-booking-toggle";
import { ClosingMessageSetting } from "@/components/clinic/closing-message-setting";
import { getClosingMessageSetting } from "@/actions/closing-message";
import { WelcomeSettings } from "@/components/clinic/welcome-settings";
import { getWelcomeSettings } from "@/actions/welcome-message";
import { InsuranceSettings } from "@/components/clinic/insurance-settings";
import { getInsuranceSettings } from "@/actions/insurance-settings";
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
  neutral: <MessageSquareText className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden />,
  attention: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden />,
} as const;
const TONE_BADGE = {
  positive: "bg-emerald-100 dark:bg-emerald-400/15",
  neutral: "bg-sky-100 dark:bg-sky-400/15",
  attention: "bg-amber-100 dark:bg-amber-400/15",
} as const;

function whenLabel(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" });
}

export default async function AiActionsPage({ searchParams }: { searchParams: Promise<{ days?: string; grupo?: string; q?: string }> }) {
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const group = params.grupo === "decisao" || params.grupo === "atendimento" ? params.grupo : undefined;
  const query = params.q?.trim() || undefined;
  const [rows, urgency, afterHours, closing, welcome, insurance] = await Promise.all([
    listAiActions(days, { group, query }),
    getUrgencyTagSetting(),
    getAfterHoursBookingSetting(),
    getClosingMessageSetting(),
    getWelcomeSettings(),
    getInsuranceSettings(),
  ]);

  const href = (over: { days?: number; grupo?: string }) => {
    const sp = new URLSearchParams();
    sp.set("days", String(over.days ?? days));
    const g = over.grupo ?? group;
    if (g && g !== "todas") sp.set("grupo", g);
    if (query) sp.set("q", query);
    return `/clinic/ia?${sp.toString()}`;
  };
  const chip = (active: boolean) =>
    `inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
      active
        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
        : "bg-white/80 ring-1 ring-slate-900/5 shadow-xs dark:bg-white/[0.08] dark:ring-white/10 hover:bg-white dark:hover:bg-white/[0.14] text-slate-700 dark:text-slate-200"
    }`;

  return (
    // Visual "vidro" (09/11/2026, DESIGN.md §5).
    <div className="soft-canvas h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6 md:p-8">
        <PageHeader
          title="Ações da IA"
          subtitle="O que a IA decidiu ou respondeu sozinha, com a mensagem do paciente que motivou. Abra a conversa para conferir ou corrigir."
        />
        <AfterHoursBookingToggle enabled={afterHours.enabled} duringHours={afterHours.duringHours} canToggle={afterHours.canToggle} />
        <WelcomeSettings {...welcome} />
        <InsuranceSettings {...insurance} />
        <ClosingMessageSetting enabled={closing.enabled} text={closing.text} canEdit={closing.canEdit} />
        <UrgencyTagToggle enabled={urgency.enabled} canToggle={urgency.canToggle} />

        <h2 className="pt-4 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">O que a IA fez</h2>
        <div className="flex flex-wrap items-center gap-2">
          {GROUPS.map((g) => (
            <Link key={g.id} href={href({ grupo: g.id })} className={chip((group ?? "todas") === g.id)} aria-current={(group ?? "todas") === g.id ? "true" : undefined}>
              {g.label}
            </Link>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-900/10 dark:bg-white/10" aria-hidden />
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
            className="h-10 w-full max-w-xs rounded-full border border-transparent bg-white/80 ring-1 ring-slate-900/5 shadow-xs dark:bg-white/[0.08] dark:ring-white/10 px-4 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <button type="submit" className="h-10 rounded-full px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-white/10">
            Buscar
          </button>
        </form>

        {rows.length === 0 ? (
          <p className="glass-surface border border-dashed border-slate-300 dark:border-white/15 p-6 text-sm text-slate-600 dark:text-slate-400">
            Nenhuma ação da IA neste período. Quando ela confirmar, cancelar ou responder sozinha, aparece aqui.
          </p>
        ) : (
          <ul className="glass-surface overflow-hidden divide-y divide-slate-900/[0.05] dark:divide-white/[0.06]">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/clinic/pacientes/${r.conversationId}`}
                  className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-white/60 dark:hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/50"
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full ${TONE_BADGE[r.tone]}`}>{TONE_ICON[r.tone]}</span>
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

import Link from "next/link";

const TABS = [
  { key: "atendimento", label: "Atendimento", href: "/clinic/relatorio", managerOnly: false },
  { key: "marcadores", label: "Marcadores", href: "/clinic/relatorio?aba=marcadores", managerOnly: false },
  { key: "faturamento", label: "Faturamento", href: "/clinic/relatorio?aba=faturamento", managerOnly: true },
  { key: "financeiro", label: "Financeiro", href: "/clinic/relatorio?aba=financeiro", managerOnly: true },
  { key: "estoque", label: "Estoque", href: "/clinic/relatorio?aba=estoque", managerOnly: true },
] as const;

/** Abas do Relatório. Faturamento, Financeiro e Estoque (e as próximas do BI) só aparecem para a gestão. */
export function ReportTabs({ active, isManager }: { active: string; isManager: boolean }) {
  const tabs = TABS.filter((t) => isManager || !t.managerOnly);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Abas do relatório" className="report-surface !rounded-full flex w-fit max-w-full gap-1 overflow-x-auto p-1.5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            t.key === active
              ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
              : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

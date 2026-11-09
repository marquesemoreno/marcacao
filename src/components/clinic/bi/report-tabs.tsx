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
    <nav aria-label="Abas do relatório" className="flex gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 dark:bg-slate-800 w-fit max-w-full">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
            t.key === active
              ? "bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-slate-100"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

import Link from "next/link";

const SECTIONS = [
  { key: "precos", href: "/clinic/precos", label: "Preços e horários" },
  { key: "perfil", href: "/clinic/perfil", label: "Minha conta" },
] as const;

/** Seções de Configurações (menu lateral › Administração › Configurações). Links, não
 * abas: cada seção é uma rota própria. */
export function SettingsSectionNav({ active }: { active: (typeof SECTIONS)[number]["key"] }) {
  return (
    <nav aria-label="Seções de configurações" className="inline-flex max-w-full gap-0.5 overflow-x-auto glass-surface !rounded-full p-1">
      {SECTIONS.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          aria-current={s.key === active ? "page" : undefined}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            s.key === active
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

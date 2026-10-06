import Link from "next/link";

const SECTIONS = [
  { key: "precos", href: "/clinic/precos", label: "Preços e horários" },
  { key: "perfil", href: "/clinic/perfil", label: "Minha conta" },
] as const;

/** Seções de Configurações (menu lateral › Administração › Configurações). Links, não
 * abas: cada seção é uma rota própria. */
export function SettingsSectionNav({ active }: { active: (typeof SECTIONS)[number]["key"] }) {
  return (
    <nav aria-label="Seções de configurações" className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
      {SECTIONS.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          aria-current={s.key === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            s.key === active
              ? "border-emerald-600 text-slate-900 dark:text-slate-100"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

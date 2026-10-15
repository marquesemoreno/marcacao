import Link from "next/link";
import { t, type Lang } from "@/lib/i18n-review";

const TABS = [
  { href: "/admin/whatsapp", key: "tabs.connect" as const },
  { href: "/admin/whatsapp/enviar", key: "tabs.send" as const },
  { href: "/admin/whatsapp/templates", key: "tabs.templates" as const },
];

/** Abas das telas da API oficial + seletor PT/EN (a gravação da análise da Meta é em inglês). */
export function CloudTabs({ lang, active }: { lang: Lang; active: string }) {
  const q = lang === "en" ? "?lang=en" : "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
      <nav aria-label="WhatsApp Cloud API" className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={`${tab.href}${q}`}
            aria-current={active === tab.href ? "page" : undefined}
            className={`h-9 inline-flex items-center rounded-lg px-3 text-sm font-medium ${
              active === tab.href
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {t(lang, tab.key)}
          </Link>
        ))}
      </nav>
      <div role="group" aria-label="Language / Idioma" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-xs">
        {(["pt", "en"] as const).map((l) => (
          <Link
            key={l}
            href={`${active}${l === "en" ? "?lang=en" : ""}`}
            aria-current={lang === l ? "true" : undefined}
            className={`px-2.5 h-7 inline-flex items-center rounded-md font-semibold ${
              lang === l ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {l.toUpperCase()}
          </Link>
        ))}
      </div>
    </div>
  );
}

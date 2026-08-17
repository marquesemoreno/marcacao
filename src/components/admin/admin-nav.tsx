"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin", label: "📊 Início", exact: true },
  { href: "/admin/inbox", label: "💬 Chat / WhatsApp" },
  { href: "/admin/crm", label: "📋 CRM (Funil de Leads)" },
  { href: "/admin/clinicas", label: "🏥 Clínicas" },
  { href: "/admin/leads", label: "📈 Leads B2B" },
  { href: "/admin/afiliados", label: "👥 Marcadores / Afiliados" },
  { href: "/admin/relatorio", label: "💲 Relatórios" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1.5">
      {navItems.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-white font-bold text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

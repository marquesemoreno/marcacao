"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin", label: "📊 Início", exact: true },
  { href: "/admin/inbox", label: "💬 Chat / WhatsApp" },
  { href: "/admin/crm", label: "📋 CRM" },
  { href: "/admin/clinicas", label: "🏥 Clínicas" },
  { href: "/admin/leads", label: "📈 Leads B2B" },
  { href: "/admin/afiliados", label: "👥 Marcadores" },
  { href: "/admin/relatorio", label: "💲 Relatórios" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
      {navItems.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              isActive
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

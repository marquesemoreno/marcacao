"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems: { href: string; label: string; exact?: boolean }[] = [
  { href: "/clinic", label: "📊 Início", exact: true },
  { href: "/clinic/inbox", label: "💬 Chat / WhatsApp" },
  { href: "/clinic/agendamentos", label: "Agendamentos" },
  { href: "/clinic/precos", label: "💲 Tabela de Preços" },
];

export function ClinicNav() {
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const fullNavItems: { href: string; label: string; exact?: boolean }[] = [
  { href: "/clinic/inbox", label: "💬 Chat / WhatsApp" },
  { href: "/clinic/crm", label: "📋 CRM (Funil de Leads)" },
  { href: "/clinic/contatos", label: "👥 Contatos" },
  { href: "/clinic/agendamentos", label: "📅 Agendamentos de Hoje" },
  { href: "/clinic/precos", label: "💲 Tabela de Procedimentos" },
];

// Clínicas com instância própria de WhatsApp (atendimento exclusivo, fora dos processos
// de agendamento do marketplace) não usam agendamento/tabela de preços do Conecta Saúde.
const exclusiveNavItems: { href: string; label: string; exact?: boolean }[] = [
  { href: "/clinic/inbox", label: "💬 Chat / WhatsApp" },
  { href: "/clinic/crm", label: "📋 CRM (Funil de Leads)" },
  { href: "/clinic/contatos", label: "👥 Contatos" },
];

export function ClinicNav({ exclusiveWhatsapp = false }: { exclusiveWhatsapp?: boolean }) {
  const pathname = usePathname();
  const navItems = exclusiveWhatsapp ? exclusiveNavItems : fullNavItems;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
      {navItems.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
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

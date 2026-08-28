"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, KanbanSquare, Users, CalendarCheck, Receipt, type LucideIcon } from "lucide-react";

const fullNavItems: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/clinic/inbox", label: "Chat / WhatsApp", icon: MessageCircle },
  { href: "/clinic/crm", label: "CRM", icon: KanbanSquare },
  { href: "/clinic/contatos", label: "Contatos", icon: Users },
  { href: "/clinic/agendamentos", label: "Agendamentos de Hoje", icon: CalendarCheck },
  { href: "/clinic/precos", label: "Tabela de Procedimentos", icon: Receipt },
];

// Clínicas com instância própria de WhatsApp (atendimento exclusivo, fora dos processos
// de agendamento do marketplace) não usam agendamento/tabela de preços do Conecta Saúde.
const exclusiveNavItems: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/clinic/inbox", label: "Chat / WhatsApp", icon: MessageCircle },
  { href: "/clinic/crm", label: "CRM", icon: KanbanSquare },
  { href: "/clinic/contatos", label: "Contatos", icon: Users },
];

export function ClinicNav({ exclusiveWhatsapp = false }: { exclusiveWhatsapp?: boolean }) {
  const pathname = usePathname();
  const navItems = exclusiveWhatsapp ? exclusiveNavItems : fullNavItems;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
      {navItems.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              isActive
                ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

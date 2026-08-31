"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  Zap,
  KanbanSquare,
  Building2,
  TrendingUp,
  Share2,
  BarChart3,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

const navItems: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/admin", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/admin/inbox", label: "Chat / WhatsApp", icon: MessageCircle },
  { href: "/admin/contatos", label: "Contatos", icon: Users },
  { href: "/admin/automacoes", label: "Automações", icon: Zap },
  { href: "/admin/disparos", label: "Disparos", icon: Megaphone },
  { href: "/admin/crm", label: "CRM", icon: KanbanSquare },
  { href: "/admin/clinicas", label: "Clínicas", icon: Building2 },
  { href: "/admin/leads", label: "Leads B2B", icon: TrendingUp },
  { href: "/admin/afiliados", label: "Marcadores", icon: Share2 },
  { href: "/admin/relatorio", label: "Relatórios", icon: BarChart3 },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
      {navItems.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
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

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
  Wrench,
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
  { href: "/admin/leads-msp", label: "Leads MSP", icon: Wrench },
  { href: "/admin/afiliados", label: "Marcadores", icon: Share2 },
  { href: "/admin/relatorio", label: "Relatórios", icon: BarChart3 },
];

/** Trilho de navegação, sempre escuro independente do tema claro/escuro do resto
 * do painel (mesmo padrão de identidade fixa do rail do MSP-dashboard) — o
 * conteúdo continua livre pra alternar claro/escuro. `orientation="horizontal"`
 * é só o fallback pra telas estreitas (abaixo do breakpoint `md`, onde o trilho
 * vertical fica escondido — ver layout.tsx); mesmas cores e estados, só o eixo
 * muda pra caber numa faixa curta e rolável. */
export function AdminNav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      className={
        isHorizontal
          ? "flex items-center gap-1 overflow-x-auto no-scrollbar px-2 py-2"
          : "flex flex-col gap-0.5 px-2.5 py-3"
      }
      aria-label="Navegação do painel administrativo"
    >
      {navItems.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`group flex shrink-0 items-center gap-2.5 rounded-lg text-[13px] font-semibold tracking-[-0.01em] transition-colors duration-150 ${
              isHorizontal ? "px-3 py-2 whitespace-nowrap" : "px-3 py-2.5"
            } ${
              isActive
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950/40"
                : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 transition-colors ${
                isActive ? "text-white" : "text-slate-500 group-hover:text-slate-200"
              }`}
            />
            <span className={isHorizontal ? "" : "truncate"}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

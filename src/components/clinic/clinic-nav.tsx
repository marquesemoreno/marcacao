"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageCircle,
  KanbanSquare,
  Users,
  CalendarCheck,
  Receipt,
  BarChart3,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const fullNavItems: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/clinic/inbox", label: "Chat / WhatsApp", icon: MessageCircle },
  { href: "/clinic/crm", label: "CRM", icon: KanbanSquare },
  { href: "/clinic/contatos", label: "Contatos", icon: Users },
  { href: "/clinic/agendamentos", label: "Agendamentos de Hoje", icon: CalendarCheck },
  { href: "/clinic/precos", label: "Tabela de Procedimentos", icon: Receipt },
  { href: "/clinic/disparos", label: "Disparos", icon: Megaphone },
  { href: "/clinic/relatorio", label: "Relatórios", icon: BarChart3 },
  { href: "/clinic/perfil", label: "Configurações", icon: Settings },
];

// Clínicas com instância própria de WhatsApp (atendimento exclusivo, fora dos processos
// de agendamento do marketplace) não usam agendamento/tabela de preços do Conecta Saúde.
// Relatórios/Disparos continuam aparecendo — nenhum dos dois depende do agendamento
// pelo marketplace (a página de relatório já esconde a seção de Agendamentos sozinha,
// ver isExclusive em /clinic/relatorio/page.tsx).
const exclusiveNavItems: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/clinic/inbox", label: "Chat / WhatsApp", icon: MessageCircle },
  { href: "/clinic/crm", label: "CRM", icon: KanbanSquare },
  { href: "/clinic/contatos", label: "Contatos", icon: Users },
  { href: "/clinic/disparos", label: "Disparos", icon: Megaphone },
  { href: "/clinic/relatorio", label: "Relatórios", icon: BarChart3 },
  { href: "/clinic/perfil", label: "Configurações", icon: Settings },
];

/** Navegação do painel da clínica — mesmo padrão visual/estrutural do AdminNav
 * (trilho vertical fixo, sempre escuro, com fallback horizontal só no mobile
 * abaixo do breakpoint `md`, ver layout.tsx), pra manter os dois painéis
 * (`/admin` e `/clinic`) com a mesma identidade de navegação. */
export function ClinicNav({
  exclusiveWhatsapp = false,
  orientation = "vertical",
  collapsed = false,
}: {
  exclusiveWhatsapp?: boolean;
  orientation?: "vertical" | "horizontal";
  /** Só vale pra orientation="vertical" — ícone sozinho, centralizado, com
   * tooltip no hover mostrando o nome da rota (ver ClinicSidebar). */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const navItems = exclusiveWhatsapp ? exclusiveNavItems : fullNavItems;
  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      className={
        isHorizontal
          ? "flex items-center gap-1 overflow-x-auto no-scrollbar px-2 py-2"
          : "flex flex-col gap-0.5 px-2.5 py-3"
      }
      aria-label="Navegação do painel da clínica"
    >
      {navItems.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
        const Icon = item.icon;
        const link = (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`group flex shrink-0 items-center gap-2.5 rounded-lg text-[13px] font-semibold tracking-[-0.01em] transition-colors duration-150 ${
              collapsed ? "justify-center px-2 py-2.5" : isHorizontal ? "px-3 py-2 whitespace-nowrap" : "px-3 py-2.5"
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
            {!collapsed && <span className={isHorizontal ? "" : "truncate"}>{item.label}</span>}
          </Link>
        );

        if (!collapsed) return link;

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger render={link} />
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

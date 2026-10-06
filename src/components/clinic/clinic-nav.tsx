"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageCircle,
  KanbanSquare,
  Users,
  CalendarCheck,
  Settings,
  BarChart3,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getMyUnreadCount } from "@/actions/clinic-shell";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: "unread"; onlyFull?: boolean };
type NavGroup = { label: string; items: NavItem[] };

/** N3 — menu agrupado. Itens `onlyFull` não aparecem pra clínicas com WhatsApp exclusivo
 * (atendimento fora do marketplace: sem agenda/tabela de preços do Conecta Saúde).
 * "Minha conta" fica no menu do usuário (avatar), junto de "Sair". */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { href: "/clinic/inbox", label: "Chat", icon: MessageCircle, badge: "unread" },
      { href: "/clinic/crm", label: "CRM", icon: KanbanSquare },
      { href: "/clinic/agendamentos", label: "Agenda", icon: CalendarCheck, onlyFull: true },
    ],
  },
  {
    label: "Cadastro",
    items: [{ href: "/clinic/contatos", label: "Pacientes", icon: Users }],
  },
  {
    label: "Administração",
    items: [
      { href: "/clinic/disparos", label: "Disparos", icon: Megaphone },
      { href: "/clinic/relatorio", label: "Relatórios", icon: BarChart3 },
      // Visível também pras clínicas só-WhatsApp (horários e ticket médio valem pra elas).
      { href: "/clinic/precos", label: "Configurações", icon: Settings },
    ],
  },
];

const UNREAD_POLL_MS = 60_000;

export function ClinicNav({
  exclusiveWhatsapp = false,
  orientation = "vertical",
  collapsed = false,
}: {
  exclusiveWhatsapp?: boolean;
  orientation?: "vertical" | "horizontal";
  /** Só vale pra orientation="vertical" — ícone sozinho com tooltip (ver ClinicSidebar). */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const isHorizontal = orientation === "horizontal";
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => getMyUnreadCount().then((n) => !cancelled && setUnread(n)).catch(() => {});
    load();
    const timer = setInterval(load, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname]);

  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !(exclusiveWhatsapp && i.onlyFull)) })).filter(
    (g) => g.items.length > 0
  );

  const renderItem = (item: NavItem) => {
    const isActive =
      pathname?.startsWith(item.href) ||
      (item.href === "/clinic/contatos" && pathname?.startsWith("/clinic/pacientes")) ||
      (item.href === "/clinic/precos" && pathname?.startsWith("/clinic/perfil"));
    const Icon = item.icon;
    const count = item.badge === "unread" ? unread : 0;
    const badgeText = count > 99 ? "99+" : String(count);
    const link = (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        aria-label={count > 0 ? `${item.label} (${count} aguardando resposta)` : undefined}
        className={`group relative flex shrink-0 items-center gap-2.5 rounded-lg text-sm font-semibold transition-colors duration-150 ${
          collapsed ? "justify-center px-2 py-2.5" : isHorizontal ? "px-3 py-2 whitespace-nowrap" : "px-3 py-2.5"
        } ${isActive ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950/40" : "text-slate-300 hover:bg-slate-800/80 hover:text-white"}`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`} />
        {!collapsed && <span className={isHorizontal ? "" : "truncate flex-1"}>{item.label}</span>}
        {count > 0 &&
          (collapsed ? (
            <span className="absolute top-1 right-1 min-w-5 h-5 px-1 rounded-full bg-rose-700 text-xs font-bold tabular-nums leading-5 text-white text-center">
              {badgeText}
            </span>
          ) : (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-xs font-bold leading-5 text-white text-center">{badgeText}</span>
          ))}
      </Link>
    );
    if (!collapsed) return link;
    return (
      <Tooltip key={item.href}>
        <TooltipTrigger render={link} />
        <TooltipContent side="right">
          {item.label}
          {count > 0 ? ` · ${count} aguardando resposta` : ""}
        </TooltipContent>
      </Tooltip>
    );
  };

  if (isHorizontal) {
    return (
      <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2 py-2" aria-label="Navegação do painel da clínica">
        {groups.flatMap((g) => g.items).map(renderItem)}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-3 px-2.5 py-3" aria-label="Navegação do painel da clínica">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <div className="mx-2 mb-1 border-t border-slate-800" aria-hidden="true" />
          ) : (
            <p className="px-3 pb-1 text-xs font-medium text-slate-400">{g.label}</p>
          )}
          {g.items.map(renderItem)}
        </div>
      ))}
    </nav>
  );
}

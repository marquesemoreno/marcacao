"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Repeat,
  MessageCircle,
  KanbanSquare,
  Users,
  CalendarCheck,
  CalendarDays,
  Handshake,
  Settings,
  BarChart3,
  Megaphone,
  Sparkles,
  ShieldCheck,
  BookOpen,
  Smartphone,
  type LucideIcon, ClipboardList, ListTodo, MonitorPlay, Ticket } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTaskCount, useUnreadCount } from "@/lib/use-unread-count";
import { can, type ClinicPermission, type ClinicRole } from "@/lib/clinic-permissions";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: "unread" | "tasks"; onlyFull?: boolean; perm?: ClinicPermission };
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
      { href: "/clinic/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/clinic/tarefas", label: "Tarefas", icon: ListTodo, badge: "tasks" },
      { href: "/clinic/senhas", label: "Senhas", icon: Ticket, perm: "chamar" },
      { href: "/clinic/agendamentos", label: "Agendamentos", icon: CalendarCheck, onlyFull: true },
    ],
  },
  {
    label: "Cadastro",
    items: [
      { href: "/clinic/contatos", label: "Pacientes", icon: Users },
      { href: "/clinic/marcadores", label: "Marcadores", icon: Handshake },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/clinic/disparos", label: "Disparos", icon: Megaphone, perm: "disparos" },
      { href: "/clinic/relatorio", label: "Relatórios", icon: BarChart3, perm: "relatorios" },
      { href: "/clinic/ia", label: "Ações da IA", icon: Sparkles },
      { href: "/clinic/processos", label: "Processos", icon: BookOpen },
      { href: "/clinic/ficha", label: "Ficha prévia", icon: ClipboardList, perm: "config" },
      { href: "/clinic/retorno", label: "Retorno", icon: Repeat, perm: "config" },
      { href: "/clinic/tv", label: "TV da sala de espera", icon: MonitorPlay, perm: "config" },
      { href: "/clinic/acessos", label: "Acessos", icon: ShieldCheck, perm: "config" },
      { href: "/clinic/whatsapp", label: "WhatsApp", icon: Smartphone, perm: "config" },
      // Visível também pras clínicas só-WhatsApp (horários e ticket médio valem pra elas).
      { href: "/clinic/precos", label: "Configurações", icon: Settings, perm: "config" },
    ],
  },
];


export function ClinicNav({
  exclusiveWhatsapp = false,
  orientation = "vertical",
  collapsed = false,
  role = "GESTAO",
}: {
  exclusiveWhatsapp?: boolean;
  /** Recepção (false) não vê Relatórios nem Configurações — ver requireClinicManager. */
  role?: ClinicRole;
  orientation?: "vertical" | "horizontal";
  /** Só vale pra orientation="vertical" — ícone sozinho com tooltip (ver ClinicSidebar). */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const isHorizontal = orientation === "horizontal";
  const unread = useUnreadCount();
  const dueTasks = useTaskCount();

  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !(exclusiveWhatsapp && i.onlyFull) && !(i.perm && !can(role, i.perm))) })).filter(
    (g) => g.items.length > 0
  );

  const renderItem = (item: NavItem) => {
    const isActive =
      pathname?.startsWith(item.href) ||
      (item.href === "/clinic/contatos" && pathname?.startsWith("/clinic/pacientes")) ||
      (item.href === "/clinic/precos" && pathname?.startsWith("/clinic/perfil"));
    const Icon = item.icon;
    const count = item.badge === "unread" ? unread : item.badge === "tasks" ? dueTasks : 0;
    const countLabel = item.badge === "tasks" ? "para hoje ou atrasadas" : "aguardando resposta";
    const badgeText = count > 99 ? "99+" : String(count);
    const link = (
      <Link
        prefetch={false}
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        // Recolhido o link é só um ícone: sem aria-label ele fica sem nome pro leitor de tela
        // (a dica que aparece ao passar o mouse não conta como nome).
        aria-label={count > 0 ? `${item.label} (${count} ${countLabel})` : collapsed ? item.label : undefined}
        className={`group relative flex shrink-0 items-center gap-2.5 rounded-lg text-sm font-semibold transition-colors duration-150 ${
          collapsed ? "justify-center px-2 py-2" : isHorizontal ? "min-h-11 px-3.5 py-2 whitespace-nowrap" : "px-3 py-2.5"
        } ${isActive ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950/40" : "text-slate-300 hover:bg-slate-800/80 hover:text-white"}`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`} />
        {!collapsed && <span className={isHorizontal ? "" : "truncate flex-1"}>{item.label}</span>}
        {count > 0 &&
          (collapsed ? (
            <span className="absolute top-1 right-1 min-w-5 h-5 px-1 rounded-md bg-rose-700 text-xs font-bold tabular-nums leading-5 text-white text-center">
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
          {count > 0 ? ` · ${count} ${countLabel}` : ""}
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
    // Recolhido: espaçamento mais justo pra o menu inteiro (16 itens na Gestão) caber sem rolar
    // numa tela de 900 px de altura. O grupo vira `role="group"` com nome, já que o título some.
    <nav className={`flex flex-col px-2.5 ${collapsed ? "gap-1.5 py-2" : "gap-3 py-3"}`} aria-label="Navegação do painel da clínica">
      {groups.map((g, index) => (
        <div key={g.label} role="group" aria-label={g.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            index > 0 && <div className="mx-2 mb-1 border-t border-slate-800" aria-hidden="true" />
          ) : (
            <p className="px-3 pb-1 text-xs font-medium text-slate-400">{g.label}</p>
          )}
          {g.items.map(renderItem)}
        </div>
      ))}
    </nav>
  );
}

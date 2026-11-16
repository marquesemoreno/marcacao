import { BookOpen, ClipboardList, MonitorPlay, Repeat, ShieldCheck, SlidersHorizontal, Smartphone, type LucideIcon } from "lucide-react";
import type { ClinicPermission } from "@/lib/clinic-permissions";

/** Telas reunidas no hub /clinic/configuracoes (16/11/2026: saíram do menu lateral para
 * encurtar o menu). O item "Configurações" do menu fica ativo em qualquer uma delas. */
export type SettingsSection = { href: string; label: string; description: string; icon: LucideIcon; perm?: ClinicPermission };

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { href: "/clinic/whatsapp", label: "WhatsApp", description: "Conexão do número da clínica e QR do aparelho", icon: Smartphone, perm: "config" },
  { href: "/clinic/precos", label: "Preços e horários", description: "Procedimentos, horário de atendimento, ticket médio, responsável técnico e links", icon: SlidersHorizontal, perm: "config" },
  { href: "/clinic/retorno", label: "Retorno", description: "Em quantos dias cada paciente deve voltar", icon: Repeat, perm: "config" },
  { href: "/clinic/ficha", label: "Ficha prévia", description: "Formulário que o paciente responde pelo celular antes da consulta", icon: ClipboardList, perm: "config" },
  { href: "/clinic/tv", label: "TV da sala de espera", description: "Painel que mostra e anuncia o paciente chamado", icon: MonitorPlay, perm: "config" },
  { href: "/clinic/acessos", label: "Acessos", description: "Quem abriu conversa, ficha ou cadastro de cada paciente", icon: ShieldCheck, perm: "config" },
  { href: "/clinic/processos", label: "Processos", description: "Como cada setor trabalha, passo a passo", icon: BookOpen },
];

/** Rotas que contam como "dentro de Configurações" (menu ativo + link de volta). */
export const SETTINGS_ROUTES = ["/clinic/configuracoes", "/clinic/perfil", ...SETTINGS_SECTIONS.map((s) => s.href)];

export function isSettingsRoute(pathname: string | null | undefined): boolean {
  return !!pathname && SETTINGS_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

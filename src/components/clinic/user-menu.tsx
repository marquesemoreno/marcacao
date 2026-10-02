"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { LogOut, MessageSquarePlus, Moon, Sun, UserCog } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FeedbackWidget } from "@/components/feedback-widget";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const itemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors";

/** Menu do usuário no avatar (P2/C5) — tema, sugestão/bug e "Sair" (com confirmação)
 * num lugar só. Antes "Sair" ficava colado ao botão de tema na barra recolhida e um
 * clique impreciso deslogava; o botão roxo de bug flutuava por cima do painel. */
export function UserMenu({
  userName,
  subtitle,
  side = "right",
  compact = false,
}: {
  userName: string | null | undefined;
  /** Linha abaixo do nome (ex: "Equipe · Urolaser") — N3: usuário e função no rodapé. */
  subtitle?: string;
  side?: "right" | "bottom";
  /** Só o avatar (barra recolhida / cabeçalho mobile). */
  compact?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = userName?.trim() || "Usuário";
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmingLogout(false);
        }}
      >
        <PopoverTrigger
          aria-label={`Menu do usuário ${name}`}
          title={name}
          className={`flex items-center gap-2 rounded-lg text-left hover:bg-slate-800/80 transition-colors ${
            compact ? "justify-center p-1" : "w-full px-2 py-1.5"
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300">
            {initials(name)}
          </span>
          {!compact && (
            <span className="min-w-0 flex flex-col">
              <span className="truncate text-sm font-medium text-slate-200">{name}</span>
              {subtitle && <span className="truncate text-xs text-slate-400">{subtitle}</span>}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent side={side} align="end" className="w-64 p-1.5">
          <div className="px-2.5 pt-1.5 pb-2 border-b border-slate-100 dark:border-slate-800 mb-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</p>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
          </div>
          <Link href="/clinic/perfil" onClick={() => setOpen(false)} className={itemClass}>
            <UserCog className="h-4 w-4" />
            Minha conta
          </Link>
          <button type="button" className={itemClass} onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-sky-500" />}
            {isDark ? "Usar tema claro" : "Usar tema escuro"}
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              setFeedbackOpen(true);
            }}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Enviar sugestão ou reportar bug
          </button>
          <div className="mt-1 border-t border-slate-100 dark:border-slate-800 pt-1">
            {confirmingLogout ? (
              <div className="px-2.5 py-2 space-y-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">Sair da sua conta?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingLogout(false)}
                    className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/entrar" })}
                    className="flex-1 rounded-md bg-rose-600 hover:bg-rose-700 px-2 py-1.5 text-sm font-semibold text-white"
                  >
                    Sair
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={`${itemClass} text-rose-700 dark:text-rose-400`} onClick={() => setConfirmingLogout(true)}>
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <FeedbackWidget open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}

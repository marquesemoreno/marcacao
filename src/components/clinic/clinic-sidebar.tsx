"use client";

import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { ClinicNav } from "@/components/clinic/clinic-nav";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const STORAGE_KEY = "clinic-sidebar-collapsed";

/** Iniciais do nome pro avatar mini (ex: "Lidiane Souza" -> "LS") — mesma lógica
 * simples usada em avatares de usuário no resto do app, sem precisar de imagem. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ClinicSidebar({
  tradeName,
  userName,
  isExclusive,
}: {
  tradeName: string;
  userName: string | null | undefined;
  isExclusive: boolean;
}) {
  // Recolhida por padrão (libera espaço pra fila/chat) — só fica expandida se o
  // usuário já tiver escolhido isso explicitamente antes (localStorage === "0").
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIsCollapsed(localStorage.getItem(STORAGE_KEY) !== "0");
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={`hidden md:flex shrink-0 flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out overflow-hidden ${
        isCollapsed ? "w-16" : "w-60"
      } ${hydrated ? "" : "invisible"}`}
    >
      <div className={`flex items-center gap-2 pt-5 pb-4 border-b border-slate-800 ${isCollapsed ? "justify-center px-2" : "px-4"}`}>
        <Logo variant={isCollapsed ? "icon-only" : "white"} size="sm" />
      </div>

      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger className="mx-auto mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold text-emerald-300 font-mono">
            {initials(tradeName)}
          </TooltipTrigger>
          <TooltipContent side="right">{tradeName}</TooltipContent>
        </Tooltip>
      ) : (
        <div className="mx-4 mt-3">
          <span className="truncate block text-xs font-extrabold text-slate-200">{tradeName}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden mt-1">
        <ClinicNav exclusiveWhatsapp={isExclusive} collapsed={isCollapsed} />
      </div>

      <div className="border-t border-slate-800 px-3 py-3 space-y-2">
        {!isCollapsed && userName && (
          <p className="truncate px-1 text-xs font-bold text-slate-300 font-mono">{userName}</p>
        )}
        <div className={`flex items-center gap-2 ${isCollapsed ? "flex-col" : "justify-between"}`}>
          {isCollapsed && userName ? (
            <Tooltip>
              <TooltipTrigger className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[10px] font-extrabold text-slate-200 font-mono">
                {initials(userName)}
              </TooltipTrigger>
              <TooltipContent side="right">{userName}</TooltipContent>
            </Tooltip>
          ) : null}
          <div className={`flex items-center gap-2 ${isCollapsed ? "flex-col" : ""}`}>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          className={`flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-white transition-colors ${
            isCollapsed ? "justify-center" : "justify-start"
          }`}
        >
          {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!isCollapsed && <span className="text-xs font-semibold">Recolher menu</span>}
        </button>
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

const STORAGE_KEY = "admin-sidebar-collapsed";

/** Trilho do painel admin — sempre escuro; recolhível como o da clínica (ver
 * ClinicSidebar). No admin começa EXPANDIDO; recolhe só se o usuário escolher. */
export function AdminSidebar({ userName }: { userName: string | null }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setIsCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
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
      }`}
    >
      <div className={`flex items-center gap-2 pt-5 pb-4 border-b border-slate-800 ${isCollapsed ? "justify-center px-2" : "px-4"}`}>
        <Logo variant={isCollapsed ? "icon-only" : "white"} size="sm" />
      </div>
      <span
        className={`mt-3 inline-flex w-fit items-center gap-1 rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-extrabold text-sky-300 font-mono ${
          isCollapsed ? "mx-auto" : "mx-4"
        }`}
        title="Admin"
      >
        🛡️{!isCollapsed && " Admin"}
      </span>

      <div className="flex-1 overflow-y-auto overflow-x-hidden mt-1">
        <AdminNav collapsed={isCollapsed} />
      </div>

      <div className="border-t border-slate-800 px-3 py-3 space-y-2">
        {!isCollapsed && userName && <p className="truncate px-1 text-xs font-bold text-slate-300 font-mono">{userName}</p>}
        <div className={`flex items-center gap-2 ${isCollapsed ? "flex-col" : "justify-between"}`}>
          <ThemeToggle />
          {!isCollapsed && <SignOutButton />}
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
          {isCollapsed ? <ChevronsRight className="h-4 w-4" aria-hidden /> : <ChevronsLeft className="h-4 w-4" aria-hidden />}
          {!isCollapsed && <span className="text-xs font-semibold">Recolher menu</span>}
        </button>
      </div>
    </aside>
  );
}

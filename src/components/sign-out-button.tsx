"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/entrar" })}
      className="gap-1.5 rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-rose-200 dark:hover:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-400"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sair
    </Button>
  );
}

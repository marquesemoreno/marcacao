"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="gap-1.5 rounded-xl border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sair
    </Button>
  );
}

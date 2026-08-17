"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAffiliateAction } from "@/actions/affiliates";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function AffiliateLogoutButton() {
  const { isPending, run } = useActionFeedback();
  const router = useRouter();

  function handleLogout() {
    run(() => logoutAffiliateAction(), { onSuccess: () => router.refresh() });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={isPending}
      className="gap-1.5 text-slate-500 hover:text-slate-900"
    >
      <LogOut className="h-4 w-4" />
      Sair
    </Button>
  );
}

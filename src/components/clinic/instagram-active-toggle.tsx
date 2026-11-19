"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setClinicInstagramActive } from "@/actions/clinic-instagram";
import type { Lang } from "@/lib/i18n-review";

/** Liga/desliga o Instagram da clínica no Chat sem apagar a conexão. */
export function InstagramActiveToggle({ active, lang }: { active: boolean; lang: Lang }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const en = lang === "en";
  const label = active ? (en ? "Turn off in inbox" : "Desligar no Chat") : en ? "Turn on in inbox" : "Ligar no Chat";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (active && !confirm(en ? "Stop receiving and replying to Instagram messages in the inbox?" : "Parar de receber e responder as mensagens do Instagram no Chat?")) return;
        start(async () => {
          try {
            await setClinicInstagramActive(!active);
            toast.success(en ? "Saved." : "Salvo.");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : en ? "Could not save." : "Não foi possível salvar.");
          }
        });
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 px-4 text-sm font-medium hover:bg-white/70 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-white/10"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {label}
    </button>
  );
}

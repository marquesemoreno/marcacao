"use client";

import { useTransition } from "react";
import { toast } from "sonner";

/**
 * Padroniza feedback visual (loading + toast) em torno de uma Server Action
 * chamada a partir de um formulário nativo. Um componente-função (render-prop)
 * não funciona aqui porque a página que renderiza o form é um Server Component
 * — não dá pra passar função como children pela fronteira RSC — então cada
 * formulário vira seu próprio Client Component que usa este hook.
 */
export function useActionFeedback() {
  const [isPending, startTransition] = useTransition();

  function run(
    action: () => Promise<void>,
    options?: { successMessage?: string; errorMessage?: string; onSuccess?: () => void }
  ) {
    startTransition(async () => {
      try {
        await action();
        if (options?.successMessage) {
          toast.success(options.successMessage);
        }
        options?.onSuccess?.();
      } catch (error) {
        toast.error(options?.errorMessage ?? "Não foi possível concluir a ação. Tente novamente.");
        console.error(error);
      }
    });
  }

  return { isPending, run };
}

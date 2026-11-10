"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Erro de uma página do painel: registra no Sentry e deixa o menu em pé com um botão de nova tentativa. */
export function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 p-10 text-center">
      <h2 className="text-lg font-semibold">Não foi possível carregar esta página</h2>
      <p className="text-sm text-slate-500">O erro foi registrado. Tente de novo; se continuar, fale com o suporte.</p>
      <button onClick={reset} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
        Tentar de novo
      </button>
    </div>
  );
}

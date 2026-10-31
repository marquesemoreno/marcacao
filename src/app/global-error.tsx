"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Erro que derruba o layout raiz: registra no Sentry e mostra uma saída simples. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h1 style={{ fontSize: 20 }}>Algo deu errado</h1>
        <p>O erro foi registrado. Tente de novo; se continuar, fale com o suporte.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px" }}>
          Tentar de novo
        </button>
      </body>
    </html>
  );
}

"use client";

let checking: Promise<void> | null = null;

/** Chamar quando uma consulta ao servidor falhar: se a sessão caiu, leva para /sair (que
 * encerra e volta ao login). Uma checagem por vez, mesmo com várias falhas juntas. */
export function checkSessionAfterError(): Promise<void> {
  if (checking) return checking;
  checking = fetch("/api/auth/alive", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { alive: true }))
    .then((j: { alive?: boolean }) => {
      if (j.alive === false) window.location.href = "/sair";
    })
    .catch(() => {})
    .finally(() => {
      checking = null;
    });
  return checking;
}

import * as Sentry from "@sentry/nextjs";

/** Sentry só de erros (sem tracing/replay) — sem SENTRY_DSN fica desligado.
 * sendDefaultPii: false para não mandar IP/cookies/corpo de requisição de pacientes (LGPD). */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // Sessão vencida/encerrada numa aba aberta: o servidor recusa certo e a tela leva ao
    // login (ver /api/auth/alive). Não é defeito — não vira alerta (MARCACAO-8).
    ignoreErrors: [/^Não autorizado$/],
  });
}

export const onRequestError = Sentry.captureRequestError;

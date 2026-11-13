import * as Sentry from "@sentry/nextjs";

// Erros do navegador — mesmo critério do servidor (ver instrumentation.ts).
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // Resposta de server action interrompida: a atendente saiu da tela (ex.: Chat → Tarefas)
    // com um pedido em andamento, ou a página ficou aberta durante um deploy. O erro real do
    // servidor, quando há, já chega pelo onRequestError do instrumentation.ts (MARCACAO-6).
    ignoreErrors: [/^Não autorizado$/, /^An unexpected response was received from the server\.?$/],
  });
}

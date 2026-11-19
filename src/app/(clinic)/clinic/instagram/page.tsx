import Link from "next/link";
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getClinicSessionOrNull } from "@/lib/session";
import { ManagerOnly, currentUserIsManager } from "@/components/clinic/manager-only";
import { InstagramActiveToggle } from "@/components/clinic/instagram-active-toggle";
import { langFrom, type Lang } from "@/lib/i18n-review";

export const metadata = { title: "Instagram" };
export const dynamic = "force-dynamic";

/** Textos desta tela em pt/en — a revisão da Meta pede a gravação em inglês (?lang=en). */
const T = {
  title: ["Instagram Direct", "Instagram Direct"],
  subtitle: [
    "Conecte o Instagram profissional da clínica para receber e responder as mensagens do Direct no Chat.",
    "Connect the clinic's Instagram professional account to receive and reply to Direct messages in the shared inbox.",
  ],
  connect: ["Conectar Instagram", "Connect Instagram"],
  reconnect: ["Conectar outra vez", "Reconnect"],
  connectTip: [
    "Abre o login do Instagram: entre com a conta da clínica e autorize o Conecta Saúde a ler o perfil e as mensagens do Direct.",
    "Opens Instagram's login: sign in with the clinic's account and allow Conecta Saúde to read the profile and Direct messages.",
  ],
  none: ["Nenhum Instagram conectado ainda.", "No Instagram account connected yet."],
  connected: ["Conectado", "Connected"],
  off: ["Desligado no Chat", "Turned off in inbox"],
  account: ["Conta", "Account"],
  expires: ["Acesso renovado automaticamente — vale até", "Access renews automatically — valid until"],
  ok: ["Instagram conectado. As mensagens do Direct já chegam no Chat.", "Instagram connected. Direct messages now arrive in the inbox."],
  cancelled: ["Conexão cancelada no Instagram — nada foi alterado.", "Connection cancelled on Instagram — nothing was changed."],
  demo: ["A clínica de demonstração não conecta Instagram de verdade.", "The demo clinic does not connect a real Instagram account."],
  needs: [
    "Precisa ser uma conta profissional (Empresa ou Criador de conteúdo), com o acesso às mensagens liberado em Configurações › Mensagens e respostas.",
    "It must be a professional account (Business or Creator) with message access enabled in Settings › Messages and story replies.",
  ],
} as const;
const tt = (lang: Lang, k: keyof typeof T) => T[k][lang === "en" ? 1 : 0];

const ERRORS: Record<string, [string, string]> = {
  sessao: ["O login expirou ou foi aberto em outra sessão. Clique em Conectar de novo.", "The login expired or was opened in another session. Click Connect again."],
  gestao: ["Só a gestão da clínica pode conectar o Instagram.", "Only the clinic's managers can connect Instagram."],
  config: ["O login do Instagram ainda não está configurado no sistema. Avise a TIVDC.", "Instagram login is not configured yet. Contact support."],
  codigo: ["O Instagram não devolveu a autorização. Tente de novo.", "Instagram did not return the authorization. Please try again."],
  permissoes: ["Faltou autorizar as mensagens. Conecte de novo e deixe as duas permissões marcadas.", "Message access was not granted. Connect again and keep both permissions checked."],
  meta: ["O Instagram recusou a conexão", "Instagram rejected the connection"],
};

export default async function ClinicInstagramPage({ searchParams }: { searchParams: Promise<{ lang?: string; ig?: string; motivo?: string; detalhe?: string }> }) {
  if (!(await currentUserIsManager())) return <ManagerOnly />;
  const [session, params] = await Promise.all([getClinicSessionOrNull(), searchParams]);
  const lang = langFrom(params.lang);
  const en = lang === "en" ? 1 : 0;
  const account = session
    ? await prisma.instagramAccount.findUnique({ where: { clinicId: session.clinicId }, select: { username: true, active: true, tokenExpiresAt: true } })
    : null;

  const banner =
    params.ig === "ok"
      ? { ok: true, text: tt(lang, "ok") }
      : params.ig === "cancelado"
        ? { ok: false, text: tt(lang, "cancelled") }
        : params.ig === "demo"
          ? { ok: false, text: tt(lang, "demo") }
          : params.ig === "erro"
            ? { ok: false, text: `${(ERRORS[params.motivo ?? ""] ?? ERRORS.codigo)[en]}${params.detalhe ? ` (${params.detalhe})` : ""}` }
            : null;

  return (
    <div className="soft-canvas h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6 md:p-8">
        <Link href="/clinic/configuracoes" prefetch={false} className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          {en ? "Settings" : "Configurações"}
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{tt(lang, "title")}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{tt(lang, "subtitle")}</p>
        </div>

        {banner && (
          <p
            role={banner.ok ? "status" : "alert"}
            className={`flex items-start gap-2 rounded-2xl border p-3 text-sm ${
              banner.ok
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            }`}
          >
            {banner.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
            {banner.text}
          </p>
        )}

        <section className="glass-surface !rounded-3xl space-y-4 p-5">
          {account ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-600/10 text-pink-700 dark:bg-pink-400/10 dark:text-pink-300">
                  <Camera className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{tt(lang, "account")}</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">@{account.username ?? "—"}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    account.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {account.active ? tt(lang, "connected") : tt(lang, "off")}
                </span>
              </div>
              <InstagramActiveToggle active={account.active} lang={lang} />
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">{tt(lang, "none")}</p>
          )}

          {account?.tokenExpiresAt && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {tt(lang, "expires")} {account.tokenExpiresAt.toLocaleDateString(en ? "en-US" : "pt-BR", { timeZone: "America/Sao_Paulo" })}.
            </p>
          )}

          <div className="space-y-1.5 border-t border-slate-200/70 pt-4 dark:border-slate-800">
            {/* Link comum (não fetch): o login do Instagram precisa de navegação de página inteira. */}
            <a
              href="/api/instagram/connect"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-500 px-5 text-sm font-semibold text-white shadow-sm hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/60"
            >
              <Camera className="h-4 w-4" aria-hidden />
              {account ? tt(lang, "reconnect") : tt(lang, "connect")}
            </a>
            <p className="text-xs text-slate-600 dark:text-slate-400">{tt(lang, "connectTip")}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{tt(lang, "needs")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

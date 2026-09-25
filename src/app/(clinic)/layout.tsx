import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { ClinicNav } from "@/components/clinic/clinic-nav";
import { FeedbackWidget } from "@/components/feedback-widget";
import { getClinicInfo } from "@/actions/clinic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClinicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [clinic, session] = await Promise.all([getClinicInfo(), getServerSession(authOptions)]);
  const isExclusive = Boolean(clinic.whatsappInstance);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Trilho de navegação — mesma identidade fixa (sempre escuro) e mesma estrutura
          do rail do /admin, pros dois painéis lerem como parte do mesmo produto. */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-slate-900 border-r border-slate-800">
        <div className="flex items-center gap-2 px-4 pt-5 pb-4 border-b border-slate-800">
          <Logo variant="white" size="sm" />
        </div>
        <div className="mx-4 mt-3 flex items-center gap-1.5">
          <span className="truncate text-xs font-extrabold text-slate-200">{clinic.tradeName}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 font-mono">
            🟢 Clínica
          </span>
        </div>

        <div className="flex-1 overflow-y-auto mt-1">
          <ClinicNav exclusiveWhatsapp={isExclusive} />
        </div>

        <div className="border-t border-slate-800 px-3 py-3 space-y-2">
          {session?.user.name && (
            <p className="truncate px-1 text-xs font-bold text-slate-300 font-mono">{session.user.name}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Barra superior compacta — só no mobile, onde o trilho fica escondido. */}
      <header className="md:hidden flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 fixed top-0 inset-x-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <Logo variant="icon-only" size="sm" />
          <span className="truncate text-xs font-extrabold text-slate-900 dark:text-slate-100">{clinic.tradeName}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden md:pt-0 pt-14">
        <div className="md:hidden border-b border-slate-800 bg-slate-900">
          <ClinicNav exclusiveWhatsapp={isExclusive} orientation="horizontal" />
        </div>
        {/* Conteúdo Principal em Tela Cheia */}
        <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
      </div>

      <FeedbackWidget />
    </div>
  );
}

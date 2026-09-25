import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { ClinicNav } from "@/components/clinic/clinic-nav";
import { ClinicSidebar } from "@/components/clinic/clinic-sidebar";
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
      <ClinicSidebar tradeName={clinic.tradeName} userName={session?.user.name} isExclusive={isExclusive} />

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

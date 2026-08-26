import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { ClinicNav } from "@/components/clinic/clinic-nav";
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Cabeçalho Slim de Linha Única (56px / h-14) */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4">
        {/* Esquerda: Logo + Nome da Clínica + Badge */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Logo variant={isExclusive ? "icon-only" : "full"} size="sm" />
          <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-2.5">
            <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-[180px]">
              {clinic.tradeName}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
              🟢 Clínica
            </span>
          </div>
        </div>

        {/* Centro: Abas de Navegação */}
        <div className="flex-1 overflow-x-auto min-w-0 flex items-center justify-center">
          <ClinicNav exclusiveWhatsapp={isExclusive} />
        </div>

        {/* Direita: Nome do Usuário + Tema + Sair */}
        <div className="flex shrink-0 items-center gap-3">
          {session?.user.name && (
            <span className="hidden text-xs font-bold text-slate-700 dark:text-slate-300 md:inline font-mono">
              {session.user.name}
            </span>
          )}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {/* Conteúdo Principal em Tela Cheia */}
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}

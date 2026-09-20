import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Trilho de navegação — sempre escuro, independente do tema claro/escuro do
          conteúdo (mesma lógica de identidade fixa usada no dashboard do MSP). */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-slate-900 border-r border-slate-800">
        <div className="flex items-center gap-2 px-4 pt-5 pb-4 border-b border-slate-800">
          <Logo variant="white" size="sm" />
        </div>
        <span className="mx-4 mt-3 inline-flex w-fit items-center gap-1 rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-extrabold text-sky-300 font-mono">
          🛡️ Admin
        </span>

        <div className="flex-1 overflow-y-auto mt-1">
          <AdminNav />
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
        <Logo variant="full" size="sm" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden md:pt-0 pt-14">
        <div className="md:hidden border-b border-slate-800 bg-slate-900">
          <AdminNav orientation="horizontal" />
        </div>
        {/* Conteúdo Principal em Tela Cheia */}
        <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
      </div>
    </div>
  );
}

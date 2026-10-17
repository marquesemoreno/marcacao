import { getServerSession } from "next-auth";
import { PanelDarkDefault } from "@/components/panel-dark-default";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
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
      <PanelDarkDefault />
      {/* Trilho de navegação — sempre escuro, independente do tema claro/escuro do
          conteúdo (mesma lógica de identidade fixa usada no dashboard do MSP). */}
      <AdminSidebar userName={session?.user.name ?? null} />

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

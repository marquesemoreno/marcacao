import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";

// Evita que o Next tente pré-renderizar estaticamente rotas protegidas
// (getServerSession não tem request de verdade em build-time e pode
// quebrar a montagem de URL — ver docs/obsidian/01, seção de deploy).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo variant="icon-only" size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-bold text-slate-900">Painel Administrativo</p>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                🛡️ Admin
              </span>
            </div>
            <p className="truncate text-xs text-slate-500">Conecta Saúde</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {session?.user.name && (
            <span className="hidden text-sm font-medium text-slate-600 sm:inline">
              {session.user.name}
            </span>
          )}
          <SignOutButton />
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <AdminNav />
      </div>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}

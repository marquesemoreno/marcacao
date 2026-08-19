import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50">
      {/* Cabeçalho Slim de Linha Única (56px / h-14) */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-4">
        {/* Esquerda: Logo + Badge */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Logo variant="full" size="sm" />
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200/80 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 font-mono">
            🛡️ Admin
          </span>
        </div>

        {/* Centro: Abas de Navegação */}
        <div className="flex-1 overflow-x-auto min-w-0 flex items-center justify-center">
          <AdminNav />
        </div>

        {/* Direita: Nome do Usuário + Sair */}
        <div className="flex shrink-0 items-center gap-3">
          {session?.user.name && (
            <span className="hidden text-xs font-bold text-slate-700 md:inline font-mono">
              {session.user.name}
            </span>
          )}
          <SignOutButton />
        </div>
      </header>

      {/* Conteúdo Principal em Tela Cheia */}
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}

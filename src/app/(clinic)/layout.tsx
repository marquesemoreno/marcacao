import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { getClinicInfo } from "@/actions/clinic";

// Evita que o Next tente pré-renderizar estaticamente rotas protegidas
// (getServerSession não tem request de verdade em build-time e pode
// quebrar a montagem de URL — ver docs/obsidian/01, seção de deploy).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClinicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clinic = await getClinicInfo();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo variant="icon-only" size="sm" />
          <div>
            <p className="text-lg font-semibold">Painel da Clínica</p>
            <p className="text-sm text-muted-foreground">{clinic.tradeName}</p>
          </div>
        </div>
        <SignOutButton />
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b px-4 py-2">
        <Link
          href="/clinic/dashboard"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Visão Geral
        </Link>
        <Link
          href="/clinic/inbox"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Inbox
        </Link>
        <Link
          href="/clinic/agendamentos"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Agendamentos
        </Link>
        <Link
          href="/clinic/precos"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Preços e Horários
        </Link>
      </nav>
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}

import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-lg font-semibold">Painel Administrativo</p>
        <SignOutButton />
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b px-4 py-2">
        <Link
          href="/admin/dashboard"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Dashboard
        </Link>
        <Link
          href="/admin/clinicas"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Clínicas
        </Link>
        <Link
          href="/admin/relatorio"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Relatório Financeiro
        </Link>
        <Link
          href="/admin/leads"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Leads
        </Link>
      </nav>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}

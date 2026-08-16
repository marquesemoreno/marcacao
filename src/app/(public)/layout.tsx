import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/public/landing/site-footer";

const navLinks = [
  { label: "Buscar clínicas", href: "/buscar" },
  { label: "Como funciona", href: "/#como-funciona" },
  { label: "Para Clínicas e Médicos", href: "/seja-parceiro" },
];

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-600 to-teal-600 text-white">
              <HeartPulse className="h-4 w-4" />
            </span>
            Marcação
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-sky-700">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              render={<Link href="/entrar" />}
              nativeButton={false}
              variant="ghost"
              className="hidden sm:inline-flex"
            >
              Sou uma clínica
            </Button>
            <Button
              render={<Link href="/buscar" />}
              nativeButton={false}
              className="bg-sky-600 text-white hover:bg-sky-700"
            >
              Agendar agora
            </Button>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

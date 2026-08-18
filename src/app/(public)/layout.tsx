import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/public/landing/site-footer";

const navLinks = [
  { label: "Procedimentos e Exames", href: "/procedimentos" },
  { label: "Clínicas Credenciadas", href: "/clinicas" },
  { label: "Como Funciona", href: "/#como-funciona" },
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
          <Link href="/">
            <Logo variant="full" size="md" />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-teal-700 transition-colors font-semibold">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              render={<Link href="/entrar" />}
              nativeButton={false}
              variant="ghost"
              className="hidden sm:inline-flex text-xs font-semibold"
            >
              Sou uma clínica
            </Button>
            <Button
              render={<Link href="/procedimentos" />}
              nativeButton={false}
              className="bg-teal-600 text-white hover:bg-teal-700 font-bold text-xs rounded-xl shadow-2xs"
            >
              Consultar Catálogo
            </Button>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

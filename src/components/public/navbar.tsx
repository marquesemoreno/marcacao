"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Building2, Stethoscope, HelpCircle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

const navLinks = [
  { label: "Procedimentos e Exames", href: "/procedimentos", icon: Stethoscope },
  { label: "Clínicas Credenciadas", href: "/clinicas", icon: Building2 },
  { label: "Como Funciona", href: "/#como-funciona", icon: HelpCircle },
  { label: "Para Clínicas e Médicos", href: "/seja-parceiro", icon: UserCheck },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Logo variant="full" size="md" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-teal-700 transition-colors font-semibold"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Action Buttons (Desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          <Button
            render={<Link href="/seja-parceiro" />}
            nativeButton={false}
            variant="ghost"
            className="text-xs font-bold text-slate-600 hover:text-teal-700"
          >
            Sou uma clínica
          </Button>
          <Button
            render={<Link href="/procedimentos" />}
            nativeButton={false}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-2xs px-4 h-10"
          >
            Consultar Catálogo
          </Button>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 md:hidden"
          aria-label="Abrir menu de navegação"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-5 shadow-lg md:hidden animate-in slide-in-from-top-2">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 hover:text-teal-700"
                >
                  <Icon className="h-4 w-4 text-teal-600" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="mt-2 flex flex-col gap-2 pt-3 border-t border-slate-100">
              <Button
                render={<Link href="/procedimentos" />}
                nativeButton={false}
                onClick={() => setMobileMenuOpen(false)}
                className="h-11 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-2xs"
              >
                Consultar Catálogo Geral
              </Button>
              <Button
                render={<Link href="/seja-parceiro" />}
                nativeButton={false}
                variant="outline"
                onClick={() => setMobileMenuOpen(false)}
                className="h-11 w-full border-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Sou uma clínica / Médico parceiro
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

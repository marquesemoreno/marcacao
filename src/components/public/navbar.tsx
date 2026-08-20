"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Building2, Stethoscope, HelpCircle, UserCheck, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";

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
        <nav className="hidden items-center gap-5 text-sm font-semibold text-slate-700 md:flex">
          <Link
            href="/procedimentos"
            className="hover:text-teal-700 transition-colors font-semibold"
          >
            Procedimentos e Exames
          </Link>

          <Link
            href="/clinicas"
            className="hover:text-teal-700 transition-colors font-semibold"
          >
            Clínicas Credenciadas
          </Link>

          <Link
            href="/#como-funciona"
            className="hover:text-teal-700 transition-colors font-semibold"
          >
            Como Funciona
          </Link>

          <Link
            href="/afiliados"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors font-bold text-xs shadow-2xs"
          >
            <span>👥 Indique e Ganhe</span>
          </Link>
        </nav>

        {/* Action Buttons (Desktop) */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/seja-parceiro"
            className="text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors"
          >
            Para Clínicas e Médicos
          </Link>

          <Link
            href="/procedimentos"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-600 px-4 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 transition-colors"
          >
            Consultar Catálogo
          </Link>
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
            <Link
              href="/procedimentos"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 hover:text-teal-700"
            >
              <Stethoscope className="h-4 w-4 text-teal-600" />
              <span>Procedimentos e Exames</span>
            </Link>

            <Link
              href="/clinicas"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 hover:text-teal-700"
            >
              <Building2 className="h-4 w-4 text-teal-600" />
              <span>Clínicas Credenciadas</span>
            </Link>

            <Link
              href="/#como-funciona"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 hover:text-teal-700"
            >
              <HelpCircle className="h-4 w-4 text-teal-600" />
              <span>Como Funciona</span>
            </Link>

            <Link
              href="/afiliados"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"
            >
              <Users className="h-4 w-4 text-emerald-600" />
              <span>Indique e Ganhe (Afiliados / Marcadores)</span>
            </Link>

            <Link
              href="/seja-parceiro"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 hover:text-teal-700"
            >
              <UserCheck className="h-4 w-4 text-teal-600" />
              <span>Para Clínicas e Médicos</span>
            </Link>

            <div className="mt-2 flex flex-col gap-2 pt-3 border-t border-slate-100">
              <Link
                href="/procedimentos"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-teal-600 text-xs font-bold text-white shadow-2xs hover:bg-teal-700"
              >
                Consultar Catálogo
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

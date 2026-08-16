import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const patientLinks = [
  { label: "Buscar clínicas", href: "/buscar" },
  { label: "Como funciona", href: "/#como-funciona" },
  { label: "Perguntas frequentes", href: "/#faq" },
];

const partnerLinks = [
  { label: "Para Clínicas e Médicos", href: "/seja-parceiro" },
  { label: "Proposta Comercial (PDF)", href: "/proposta-comercial" },
  { label: "Área da clínica", href: "/entrar" },
  { label: "Fale com o time comercial", href: "mailto:parcerias@conectasaudevc.com.br" },
];

const supportLinks = [
  { label: "Fale conosco", href: "mailto:contato@conectasaudevc.com.br" },
  { label: "Termos de Uso", href: "/termos" },
  { label: "Política de Privacidade", href: "/privacidade" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-50 print:hidden">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Logo variant="full" size="md" />
            <p className="text-sm text-slate-600">
              Marcação de consultas e exames em clínicas parceiras, com confirmação e
              acompanhamento pelo WhatsApp.
            </p>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
              Ambiente seguro
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Para pacientes</h3>
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              {patientLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-sky-700">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Para clínicas parceiras</h3>
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              {partnerLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-sky-700">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Suporte</h3>
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              {supportLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="inline-flex items-center gap-1.5 hover:text-sky-700">
                    {link.label === "Fale conosco" && <Mail className="h-3.5 w-3.5" />}
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          © {year} Conecta Saúde. Todos os direitos reservados. Uma solução desenvolvida pela TIVDC.
        </div>
      </div>
    </footer>
  );
}

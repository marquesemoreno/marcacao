import Link from "next/link";
import {
  Mail,
  ShieldCheck,
  MapPin,
  Building,
  CheckCircle2,
} from "lucide-react";

const patientLinks = [
  { label: "Buscar Clínicas e Especialidades", href: "/buscar" },
  { label: "Como Funciona", href: "/#como-funciona" },
  { label: "Validar Guia de Encaminhamento", href: "/validar" },
  { label: "Perguntas Frequentes (FAQ)", href: "/#faq" },
];

const partnerLinks = [
  { label: "Seja uma Clínica Parceira", href: "/seja-parceiro", highlight: true },
  { label: "Proposta Comercial B2B (PDF)", href: "/proposta-comercial" },
  { label: "Painel da Clínica Credenciada", href: "/entrar" },
  { label: "Falar com Time de Parcerias", href: "mailto:parcerias@conectasaudevc.com.br" },
];

const legalLinks = [
  { label: "Termos de Uso", href: "/termos" },
  { label: "Política de Privacidade", href: "/privacidade" },
  { label: "Segurança e Proteção de Dados (LGPD)", href: "/privacidade#lgpd" },
];

const coverageCities = [
  "Vitória da Conquista",
  "Planalto",
  "Barra do Choça",
  "Poções",
  "Itambé",
  "Cândido Sales",
  "Anagé",
  "Belo Campo",
];

export function SiteFooter() {
  const currentYear = 2026;

  return (
    <footer className="border-t border-slate-200/80 bg-slate-900 text-slate-300 print:hidden relative overflow-hidden">
      
      {/* Top Banner: Regional Presence & Trust */}
      <div className="border-b border-slate-800 bg-slate-950/60 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <MapPin className="size-4" />
            </span>
            <span>
              <strong className="text-white font-semibold">Cidades atendidas:</strong>{" "}
              {coverageCities.slice(0, 5).join(" • ")} e região
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1 text-emerald-400 border border-slate-700">
              <CheckCircle2 className="size-3.5" />
              100% Conforme LGPD
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1 text-sky-400 border border-slate-700">
              <ShieldCheck className="size-3.5" />
              Ambiente Seguro
            </span>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          
          {/* Column 1 & 2: Branding & Mission */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-teal-500 to-emerald-500 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-sky-500/20">
                CS
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white block">
                  Conecta<span className="text-teal-400">Saúde</span>
                </span>
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block -mt-1">
                  CONSULTAS & EXAMES
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              A plataforma inteligente que conecta pacientes a clínicas e médicos renomados do Sudoeste Baiano. Agendamento sem mensalidade, sem carência e direto no WhatsApp.
            </p>

            {/* Contact Badges */}
            <div className="mt-2 flex flex-col gap-2.5 text-xs text-slate-300">
              <a
                href="mailto:contato@conectasaudevc.com.br"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <Mail className="size-4 text-teal-400 shrink-0" />
                <span>contato@conectasaudevc.com.br</span>
              </a>
              <a
                href="mailto:parcerias@conectasaudevc.com.br"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <Building className="size-4 text-emerald-400 shrink-0" />
                <span>parcerias@conectasaudevc.com.br</span>
              </a>
            </div>
          </div>

          {/* Column 3: Para Pacientes */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Para Pacientes
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
              {patientLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="hover:text-teal-400 transition-colors inline-flex items-center gap-1.5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Para Clínicas & Médicos */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Para Clínicas & Médicos
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
              {partnerLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={`transition-colors inline-flex items-center gap-1.5 ${
                      link.highlight
                        ? "text-emerald-400 font-semibold hover:text-emerald-300"
                        : "hover:text-teal-400"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 5: Legal & Conformidade */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Institucional & Legal
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="hover:text-teal-400 transition-colors inline-flex items-center gap-1.5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Attribution */}
        <div className="mt-14 border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {currentYear} <strong className="text-slate-400">Conecta Saúde</strong>. Todos os direitos reservados.
          </p>

          <p className="flex items-center gap-1">
            Desenvolvido com tecnologia e dedicação pela{" "}
            <span className="font-bold text-slate-300">TIVDC</span>.
          </p>
        </div>

      </div>
    </footer>
  );
}

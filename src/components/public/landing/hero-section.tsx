import { CheckCircle2 } from "lucide-react";
import { HeroSearch } from "@/components/public/landing/hero-search";

const socialProof = [
  "+30 Clínicas Credenciadas",
  "Sem Mensalidade",
  "Confirmação no WhatsApp",
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-sky-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-32 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-sm font-medium text-sky-700">
          ⚡ A forma mais rápida de marcar consultas e exames em Vitória da Conquista
        </span>

        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Cuidado com a sua saúde{" "}
          <span className="bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent">
            sem complicação
          </span>{" "}
          e com preços acessíveis
        </h1>

        <p className="max-w-2xl text-balance text-lg text-slate-600">
          Compare preços e horários em clínicas de confiança, agende em poucos cliques e
          receba tudo direto no seu WhatsApp — sem plano de saúde, sem burocracia.
        </p>

        <div className="w-full max-w-3xl pt-2">
          <HeroSearch />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm font-medium text-slate-600">
          {socialProof.map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-sky-600" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

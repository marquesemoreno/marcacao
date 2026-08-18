import { ShieldCheck, Clock, Award } from "lucide-react";
import { HeroSearch } from "@/components/public/landing/hero-search";

const trustBadges = [
  { label: "+30 Clínicas Credenciadas", icon: Award },
  { label: "Zero Mensalidade", icon: ShieldCheck },
  { label: "Confirmação no WhatsApp em 2 min", icon: Clock },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#FAFAFB] pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pb-28">
      {/* Mesh gradient lighting (Oscar Health / Stripe aesthetic) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-0 h-[38rem] w-[54rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-500/10 via-teal-500/10 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-28 -z-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-20 -z-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 opacity-[0.35] bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:28px_28px]"
      />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:px-8">
        {/* Floating badge */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-200/80 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md transition-all hover:border-emerald-300">
          <span className="relative flex h-2.5 w-2.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>Agendamento em tempo real • Sem mensalidade • Disponível em várias cidades</span>
        </div>

        {/* Title & Subtitle */}
        <h1 className="max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl lg:leading-[1.12]">
          Marque suas consultas e exames com{" "}
          <span className="text-teal-600">agilidade e preços acessíveis</span>
        </h1>

        <p className="max-w-2xl text-balance text-base text-slate-600 sm:text-lg lg:text-xl font-normal leading-relaxed">
          Escolha a sua cidade, compare clínicas credenciadas, veja valores transparentes e receba tudo no WhatsApp.
        </p>

        {/* Floating Search Bar */}
        <div className="w-full max-w-4xl pt-2">
          <HeroSearch />
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-4 text-xs sm:text-sm font-medium text-slate-600">
          {trustBadges.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 border border-slate-200/60 shadow-xs backdrop-blur-xs text-slate-700"
            >
              <Icon className="h-4 w-4 text-sky-600" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

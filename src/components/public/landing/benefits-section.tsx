import Link from "next/link";
import { 
  BadgePercent, 
  ShieldCheck, 
  Zap, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles 
} from "lucide-react";
import { Button } from "@/components/ui/button";

const benefits = [
  {
    icon: BadgePercent,
    badge: "Até 40% OFF",
    title: "Economia Real de até 40%",
    description:
      "Valores acessíveis e negociados diretamente com as clínicas parceiras da região, sem intermediários encarecendo seu atendimento.",
    highlight: "Sem taxas surpresa",
    accentGradient: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50/70 border-emerald-200/60 text-emerald-700",
    iconBg: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: ShieldCheck,
    badge: "Zero Assinatura",
    title: "Sem Mensalidade nem Carência",
    description:
      "Você não paga plano de saúde, mensalidade nem taxas ocultas. Pague apenas o valor acordado do procedimento no balcão da clínica.",
    highlight: "Uso livre e imediato",
    accentGradient: "from-sky-500 to-blue-600",
    bgLight: "bg-sky-50/70 border-sky-200/60 text-sky-700",
    iconBg: "bg-sky-500/10 text-sky-600",
  },
  {
    icon: Zap,
    badge: "100% WhatsApp",
    title: "Agendamento em Menos de 2 Minutos",
    description:
      "Confirmação ágil no celular e Guia Digital com QR Code exclusivo para check-in rápido e prioritário na recepção da clínica.",
    highlight: "Sem filas ou ligações",
    accentGradient: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50/70 border-amber-200/60 text-amber-700",
    iconBg: "bg-amber-500/10 text-amber-600",
  },
  {
    icon: Building2,
    badge: "Rede Oficial",
    title: "Rede de Clínicas Verificada",
    description:
      "Profissionais qualificados e centros de diagnóstico renomados em Vitória da Conquista, Planalto e municípios do Sudoeste Baiano.",
    highlight: "Médicos conceituados",
    accentGradient: "from-teal-500 to-emerald-600",
    bgLight: "bg-teal-50/70 border-teal-200/60 text-teal-700",
    iconBg: "bg-teal-500/10 text-teal-600",
  },
];

export function BenefitsSection() {
  return (
    <section className="relative overflow-hidden bg-slate-50/70 py-20 lg:py-28 border-t border-slate-200/60">
      {/* Background Decorative Blur & Mesh */}
      <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-4 py-1.5 text-xs font-semibold text-sky-800 shadow-sm backdrop-blur-sm">
            <Sparkles className="size-3.5 text-sky-600" />
            <span>Vantagens Exclusivas Conecta Saúde</span>
          </div>
          
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Por que milhares de pessoas escolhem a{" "}
            <span className="text-teal-600">Conecta Saúde</span>
            ?
          </h2>
          
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Reinventamos o acesso à saúde privada na Bahia. Cuidar de você e da sua família agora é simples, transparente e sem burocracia.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-teal-500/40 hover:shadow-xl hover:shadow-slate-900/5"
              >
                <div>
                  {/* Top Row: Icon & Tag */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex size-12 items-center justify-center rounded-2xl ${benefit.iconBg} transition-transform duration-300 group-hover:scale-110 shadow-sm`}
                    >
                      <Icon className="size-6" />
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide ${benefit.bgLight}`}
                    >
                      {benefit.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="mt-6 text-lg font-bold text-slate-900 group-hover:text-teal-950 transition-colors">
                    {benefit.title}
                  </h3>
                  
                  <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>

                {/* Bottom Highlight */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    {benefit.highlight}
                  </span>
                  <span className="text-slate-300 group-hover:text-teal-600 transition-colors">
                    →
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Banner de Conversão Integrado */}
        <div className="mt-12 overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl sm:p-10 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-sky-300">
              ⚡ Sem taxa de adesão
            </span>
            <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-white">
              Pronto para economizar na sua próxima consulta ou exame?
            </h3>
            <p className="mt-2 text-sm sm:text-base text-slate-300">
              Consulte horários disponíveis hoje mesmo nas principais clínicas de Vitória da Conquista e região.
            </p>
          </div>

          <div className="mt-6 lg:mt-0 flex flex-wrap gap-4 items-center">
            <Button
              render={<Link href="/buscar" />}
              nativeButton={false}
              size="lg"
              className="h-13 w-full sm:w-auto gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-7 rounded-2xl shadow-lg shadow-emerald-500/20 text-base"
            >
              Buscar Clínicas e Exames
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

      </div>
    </section>
  );
}

import {
  Search,
  CalendarCheck,
  QrCode,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface StepItem {
  number: string;
  badge: string;
  title: string;
  description: string;
  highlight: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
  icon: React.ElementType;
}

const steps: StepItem[] = [
  {
    number: "01",
    badge: "Busca Inteligente",
    title: "Encontre seu médico ou exame",
    description:
      "Pesquise pela especialidade, exame ou clínica desejada em Vitória da Conquista, Planalto e região com total transparência de preços.",
    highlight: "Clínicas credenciadas e valores a partir de R$ 45",
    gradient: "from-sky-500 to-teal-500",
    iconBg: "bg-sky-50 border-sky-200/60",
    iconColor: "text-sky-600",
    icon: Search,
  },
  {
    number: "02",
    badge: "Agilidade Total",
    title: "Agende em menos de 2 minutos",
    description:
      "Escolha o melhor dia e horário sem burocracia, sem mensalidades fixas e sem carência. Seu atendimento é pré-reservado na hora.",
    highlight: "Economia de até 40% em relação ao particular",
    gradient: "from-teal-500 to-emerald-500",
    iconBg: "bg-teal-50 border-teal-200/60",
    iconColor: "text-teal-600",
    icon: CalendarCheck,
  },
  {
    number: "03",
    badge: "Direto no WhatsApp",
    title: "Receba a Guia e vá à clínica",
    description:
      "Receba as instruções de preparo e a Guia Oficial com QR Code direto no WhatsApp. Apresente na recepção e garanta seu desconto.",
    highlight: "Sem instalar apps • Lembretes automáticos",
    gradient: "from-emerald-500 to-teal-600",
    iconBg: "bg-emerald-50 border-emerald-200/60",
    iconColor: "text-emerald-600",
    icon: QrCode,
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative overflow-hidden bg-slate-50/70 py-20 lg:py-28">
      {/* Background soft ambient lights */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[450px] w-full max-w-7xl bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.08),rgba(255,255,255,0))]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/60 bg-sky-50/80 px-3.5 py-1.5 text-xs font-semibold text-sky-800 shadow-sm backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            Simples, Rápido e Sem Burocracia
          </div>
          
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Como funciona a Conecta Saúde em{" "}
            <span className="bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
              3 passos simples
            </span>
          </h2>
          
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Cuidar da sua saúde não precisa ser caro nem complicado. Conectamos você aos melhores centros médicos com agilidade e preços acessíveis.
          </p>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-teal-300/80 hover:shadow-xl sm:p-8"
              >
                {/* Connecting arrow indicator for desktop (steps 1 & 2) */}
                {index < 2 && (
                  <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                    <span className="flex size-8 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 group-hover:text-teal-600 group-hover:border-teal-200 transition-colors">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                )}

                <div>
                  {/* Top Bar: Pill number + Icon */}
                  <div className="flex items-center justify-between gap-4">
                    <span className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-r ${step.gradient} px-3.5 py-1.5 text-xs font-black tracking-wider text-white shadow-sm`}>
                      PASSO {step.number}
                    </span>

                    <div className={`flex size-12 items-center justify-center rounded-2xl border ${step.iconBg} shadow-xs transition-transform duration-300 group-hover:scale-110`}>
                      <Icon className={`h-6 w-6 ${step.iconColor}`} />
                    </div>
                  </div>

                  {/* Badge & Title */}
                  <div className="mt-6">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {step.badge}
                    </span>
                    <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900 group-hover:text-teal-900 transition-colors">
                      {step.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {step.description}
                  </p>
                </div>

                {/* Highlight footer */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-700">
                    {step.highlight}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Trust CTA Ribbon */}
        <div className="mt-12 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Pronto para agendar sua consulta ou exame?
                </p>
                <p className="text-xs text-slate-500">
                  Atendimento humanizado e confirmação imediata no WhatsApp.
                </p>
              </div>
            </div>

            <a
              href="#busca"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-105 active:scale-98"
            >
              <span>Buscar Especialidades</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}

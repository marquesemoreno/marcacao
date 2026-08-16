import { Search, CalendarCheck, MessageCircle, type LucideIcon } from "lucide-react";

type Step = {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const steps: Step[] = [
  {
    number: "1",
    title: "Escolha o que precisa",
    description: "Encontre seu médico ou exame em clínicas de confiança perto de você.",
    icon: Search,
  },
  {
    number: "2",
    title: "Escolha a data e veja o preparo",
    description:
      "Sem surpresas: saiba horários, valores e instruções de jejum antes de confirmar.",
    icon: CalendarCheck,
  },
  {
    number: "3",
    title: "Receba tudo no WhatsApp",
    description: "Confirmação rápida e lembretes automáticos direto no seu celular.",
    icon: MessageCircle,
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Como funciona</h2>
          <p className="mt-3 text-slate-600">Em poucos passos, sem burocracia e sem sair de casa.</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map(({ number, title, description, icon: Icon }) => (
            <div
              key={number}
              className="relative flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-base font-bold text-white">
                  {number}
                </span>
                <Icon className="h-6 w-6 text-teal-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

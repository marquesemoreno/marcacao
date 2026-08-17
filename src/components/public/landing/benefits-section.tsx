import Link from "next/link";
import { Zap, ShieldCheck, Wallet, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";

const benefits = [
  {
    icon: Wallet,
    title: "Preços mais acessíveis",
    description: "Compare valores entre clínicas e encontre exames com desconto, sem precisar negociar.",
  },
  {
    icon: Zap,
    title: "Sem carência nem mensalidade",
    description: "Agende quando precisar, sem contrato, taxa de adesão ou fidelidade.",
  },
  {
    icon: CalendarClock,
    title: "Agilidade no agendamento",
    description: "Muitas clínicas oferecem horários no mesmo dia ou na semana seguinte.",
  },
  {
    icon: ShieldCheck,
    title: "Pagamento direto na clínica",
    description: "Sem intermediação financeira — você paga na hora do atendimento, do jeito que preferir.",
  },
];

export function BenefitsSection() {
  return (
    <section className="bg-slate-50/50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 rounded-3xl bg-slate-900 p-8 text-white shadow-sm sm:p-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-4">
            <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-sky-300">
              Sem plano de saúde? Sem problema.
            </span>
            <h2 className="text-3xl font-bold tracking-tight">
              Agende exames e consultas particulares com agilidade e preço justo
            </h2>
            <p className="text-slate-300">
              Não ter plano de saúde não deveria significar pagar mais caro ou esperar semanas.
              Nossas clínicas parceiras oferecem condições especiais para quem agenda direto
              pela plataforma.
            </p>
            <Button
              render={<Link href="/buscar?category=EXAM" />}
              nativeButton={false}
              size="lg"
              className="mt-2 h-12 w-fit gap-2 bg-emerald-500 px-6 text-base text-white hover:bg-emerald-400"
            >
              Buscar exames particulares
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {benefits.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <span className="flex size-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs text-slate-300">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { CalendarClock, LayoutDashboard, Wallet } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { PartnerLeadForm } from "@/components/public/partner-lead-form";

export const metadata = {
  title: "Seja um Parceiro | Conecta Saúde",
  description:
    "Aumente o fluxo de pacientes particulares na sua clínica em Vitória da Conquista, sem mensalidade.",
};

const benefits = [
  {
    icon: CalendarClock,
    title: "Ocupação de horários ociosos",
    description: "Preencha vagas que sobram na agenda com pacientes que já estão procurando por você.",
  },
  {
    icon: Wallet,
    title: "Sem taxa de adesão",
    description: "Comissão só sobre agendamentos realizados de verdade — nada de mensalidade fixa.",
  },
  {
    icon: WhatsAppIcon,
    title: "Confirmação automática no WhatsApp",
    description: "O paciente recebe lembrete e confirmação sozinho, sem sua equipe precisar ligar.",
  },
  {
    icon: LayoutDashboard,
    title: "Painel simples para a recepção",
    description: "Sua equipe vê a agenda, confirma presença e muda status em poucos cliques.",
  },
];

export default function PartnerLandingPage() {
  return (
    <main className="flex flex-col">
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-sm font-medium text-sky-700">
            Para clínicas e médicos de Vitória da Conquista
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Aumente o fluxo de pacientes particulares na sua clínica{" "}
            <span className="bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent">
              sem custo fixo de mensalidade
            </span>
          </h1>
          <p className="max-w-2xl text-balance text-lg text-slate-600">
            Cadastre sua clínica na maior plataforma de agendamento de consultas e exames da
            cidade. Você só paga comissão quando o paciente realmente é atendido.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Por que ser parceiro</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {benefits.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Cadastre o interesse da sua clínica
            </h2>
            <p className="mt-3 text-slate-600">
              Preencha o formulário abaixo — nossa equipe entra em contato pelo WhatsApp ou e-mail.
            </p>
          </div>
          <PartnerLeadForm />
        </div>
      </section>
    </main>
  );
}

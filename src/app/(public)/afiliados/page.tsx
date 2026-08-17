import Link from "next/link";
import { Share2, QrCode, Wallet, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AffiliateSignupForm } from "@/components/public/affiliate-signup-form";

export const metadata = {
  title: "Seja um Marcador Parceiro | Conecta Saúde",
  description:
    "Ganhe renda extra indicando pacientes para consultas e exames na região. Cadastre-se de graça e receba por indicação confirmada.",
};

const steps = [
  {
    icon: Share2,
    title: "1. Receba seu link exclusivo",
    description: "Ao ser aprovado, você ganha um link e QR Code próprios para divulgar no seu WhatsApp e redes sociais.",
  },
  {
    icon: Users,
    title: "2. Indique pacientes",
    description: "Compartilhe com vizinhos, clientes ou pacientes que precisam de consultas e exames particulares.",
  },
  {
    icon: Wallet,
    title: "3. Receba sua comissão",
    description: "A cada agendamento confirmado pelo seu link, uma comissão é creditada automaticamente na sua conta.",
  },
];

const audiences = [
  "Marcadores de consulta",
  "Líderes comunitários",
  "Farmácias e drogarias",
  "Agentes de saúde",
  "Cabeleireiros e salões",
  "Qualquer pessoa com uma boa rede de contatos",
];

export default function AffiliateLandingPage() {
  return (
    <main className="flex flex-col">
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
            Programa de Marcadores e Afiliados
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Ganhe renda extra indicando pacientes para{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              consultas e exames na região
            </span>
          </h1>
          <p className="max-w-2xl text-balance text-lg text-slate-600">
            Cadastre-se de graça, receba seu link e QR Code exclusivos e ganhe uma comissão por cada
            paciente que agendar através da sua indicação — sem precisar vender nada, só compartilhar.
          </p>
          <Button
            render={<a href="#cadastro" />}
            nativeButton={false}
            size="lg"
            className="h-12 gap-2 bg-emerald-600 text-base text-white hover:bg-emerald-700"
          >
            Quero ser um Marcador
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Como funciona</h2>
            <p className="mt-3 text-slate-600">Simples, sem burocracia e sem custo para se cadastrar.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
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
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Feito para quem já indica</h2>
              <p className="mt-3 text-slate-600">
                Se você já indica consultas e exames informalmente, formalize isso e comece a receber por
                cada indicação confirmada. O programa é ideal para:
              </p>
              <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {audiences.map((audience) => (
                  <li
                    key={audience}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700"
                  >
                    <Users className="h-4 w-4 shrink-0 text-emerald-600" />
                    {audience}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <QrCode className="h-6 w-6" />
              </span>
              <h3 className="text-lg font-semibold text-slate-900">Já é marcador cadastrado?</h3>
              <p className="text-sm text-slate-600">
                Acesse seu painel para ver seu link de divulgação, o QR Code e o histórico de indicações.
              </p>
              <Button
                render={<Link href="/afiliados/painel" />}
                nativeButton={false}
                variant="outline"
                className="h-11"
              >
                Entrar no painel do marcador
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="cadastro" className="bg-white">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Cadastre-se como Marcador</h2>
            <p className="mt-3 text-slate-600">
              Preencha seus dados abaixo — sua ativação é confirmada pelo nosso time em até 24h pelo
              WhatsApp.
            </p>
          </div>
          <AffiliateSignupForm />
        </div>
      </section>
    </main>
  );
}

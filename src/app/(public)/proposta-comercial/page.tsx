import type { Metadata } from "next";
import { CheckCircle2, HeartPulse, Search, Bell, QrCode, Wallet, ShieldCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProposalActionBar } from "@/components/public/proposal-action-bar";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = {
  title: "Proposta Comercial | Conecta Saúde",
  description:
    "Programa de Parceria Comercial para Clínicas e Laboratórios de Vitória da Conquista — sem taxa de adesão, sem mensalidade, comissão só sobre agendamentos realizados.",
};

const valueProps = [
  {
    title: "Sem taxa de adesão",
    description: "Nenhum custo para cadastrar sua clínica e começar a receber pacientes.",
  },
  {
    title: "Sem mensalidade",
    description: "Nenhuma cobrança fixa, independente do volume de agendamentos no mês.",
  },
  {
    title: "100% no sucesso",
    description: "Comissão cobrada apenas sobre agendamentos efetivamente realizados.",
  },
  {
    title: "Recebimento no balcão",
    description: "O paciente paga direto na clínica, no dia do atendimento — sem intermediação financeira.",
  },
];

const flowSteps = [
  {
    number: "1",
    title: "Solicitação do paciente",
    description: "O paciente busca e solicita o agendamento pela plataforma, sem precisar de conta.",
    icon: Search,
  },
  {
    number: "2",
    title: "Notificação e confirmação da clínica",
    description: "Sua equipe recebe o pedido e confirma o horário direto pelo painel ou WhatsApp.",
    icon: Bell,
  },
  {
    number: "3",
    title: "Atendimento com Guia Digital",
    description: "O paciente chega com a guia de encaminhamento e QR Code — validação rápida na recepção.",
    icon: QrCode,
  },
  {
    number: "4",
    title: "Acerto mensal transparente",
    description: "Fechamento de comissão com relatório detalhado por agendamento, sem surpresas.",
    icon: Wallet,
  },
];

type CommissionRow = {
  procedure: string;
  counterPrice: number;
  platformPrice: number;
  techFeeRate: number;
};

const commissionRows: CommissionRow[] = [
  { procedure: "Consulta Especializada", counterPrice: 250, platformPrice: 200, techFeeRate: 12 },
  { procedure: "Ultrassom", counterPrice: 220, platformPrice: 180, techFeeRate: 12 },
  { procedure: "Eletrocardiograma (ECG)", counterPrice: 150, platformPrice: 120, techFeeRate: 10 },
  { procedure: "Doppler", counterPrice: 300, platformPrice: 250, techFeeRate: 14 },
  { procedure: "Colonoscopia", counterPrice: 1200, platformPrice: 1000, techFeeRate: 15 },
];

const commitments = [
  "Sem fidelidade mínima — encerre a parceria quando quiser, sem multa.",
  "Liberdade total para abrir ou pausar horários na agenda a qualquer momento.",
  "Dados da clínica e dos pacientes protegidos conforme a LGPD.",
  "Suporte direto da equipe Conecta Saúde durante toda a parceria.",
];

export default function ProposalPage() {
  const today = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date());

  return (
    <div className="bg-white">
      <ProposalActionBar />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 print:max-w-full print:px-0 print:py-6">
        <header className="flex flex-col gap-4 border-b-2 border-sky-600 pb-8">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <span className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-600 to-teal-600 text-white">
                <HeartPulse className="h-5 w-5" />
              </span>
              Conecta Saúde
            </span>
            <span className="text-sm text-slate-500">{today}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Programa de Parceria Comercial para Clínicas e Laboratórios de Vitória da Conquista
          </h1>
          <p className="text-sm text-slate-500">
            Uma solução desenvolvida pela <span className="font-semibold text-slate-700">TIVDC</span>
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">Proposta de Valor — Risco Zero</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {valueProps.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 print:border-slate-300"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">Como Funciona o Fluxo</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {flowSteps.map(({ number, title, description, icon: Icon }) => (
              <div
                key={number}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 print:border-slate-300"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                    {number}
                  </span>
                  <Icon className="h-5 w-5 text-teal-600" />
                </div>
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="text-sm text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">Procedimentos e Comissionamento Sugerido</h2>
          <p className="mt-1 text-sm text-slate-500">
            Valores de referência — a tabela final é personalizada por clínica, de acordo com o procedimento e
            volume de agendamentos.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 print:border-slate-300">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedimento</TableHead>
                  <TableHead className="text-right">Preço Balcão</TableHead>
                  <TableHead className="text-right">Preço Conecta Saúde</TableHead>
                  <TableHead className="text-right">Taxa de Tecnologia</TableHead>
                  <TableHead className="text-right">Repasse Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionRows.map((row) => {
                  const techFee = (row.platformPrice * row.techFeeRate) / 100;
                  const netPayout = row.platformPrice - techFee;
                  return (
                    <TableRow key={row.procedure}>
                      <TableCell className="font-medium text-slate-900">{row.procedure}</TableCell>
                      <TableCell className="text-right text-slate-500 line-through">
                        {formatCurrency(row.counterPrice)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sky-700">
                        {formatCurrency(row.platformPrice)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">{row.techFeeRate}%</TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {formatCurrency(netPayout)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">Termo de Compromisso e Garantias</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {commitments.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                <span className="text-sm text-slate-600">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          Conecta Saúde — Uma solução desenvolvida pela TIVDC. Proposta válida por 30 dias a partir da data de
          emissão.
        </footer>
      </main>
    </div>
  );
}

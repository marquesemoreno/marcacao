import type { Metadata } from "next";
import {
  HeartPulse,
  ShieldCheck,
  Building2,
  Receipt,
  QrCode,
  CalendarCheck,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Laptop,
  Check,
} from "lucide-react";
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
  title: "Proposta Comercial Executiva | Conecta Saúde",
  description:
    "Programa de Credenciamento e Parceria Comercial para Clínicas, Hospitais e Laboratórios em Vitória da Conquista e Região. Risco zero, adesão R$ 0, mensalidade R$ 0, prática da tabela oficial de marcadores.",
};

const pillars = [
  {
    icon: Building2,
    badge: "Sua Tabela Atual",
    title: "1. Tabela Própria da Clínica",
    description:
      "Praticamos rigorosamente a Tabela Oficial de Parceiros/Marcadores que sua clínica já utiliza. Zero atrito ou desconto forçado.",
    color: "from-sky-50 to-blue-50/50 text-sky-700 border-sky-200",
  },
  {
    icon: Receipt,
    badge: "Liquidez Imediata",
    title: "2. Pagamento Direto no Balcão",
    description:
      "O paciente efetua o pagamento integral diretamente no caixa da sua recepção (Dinheiro, PIX ou Cartão) no dia do atendimento.",
    color: "from-emerald-50 to-teal-50/50 text-emerald-700 border-emerald-200",
  },
  {
    icon: QrCode,
    badge: "Zero Fila",
    title: "3. Check-in Express via QR Code",
    description:
      "O paciente chega com a Guia Digital no WhatsApp contendo o preparo conferido e QR Code de validação instantânea no balcão.",
    color: "from-purple-50 to-indigo-50/50 text-purple-700 border-purple-200",
  },
  {
    icon: CalendarCheck,
    badge: "Agenda Cheia",
    title: "4. Ocupação de Horários Ociosos",
    description:
      "Preenchimento inteligente das lacunas na sua agenda médica e de exames, maximizando o faturamento sem elevar custos fixos.",
    color: "from-amber-50 to-orange-50/50 text-amber-700 border-amber-200",
  },
];

const operationalFlow = [
  {
    step: "01",
    title: "Cadastro da Tabela de Marcadores",
    description:
      "Sua equipe cadastra os procedimentos e valores da Tabela Oficial de Marcadores que a clínica já pratica no nosso painel.",
  },
  {
    step: "02",
    title: "Agendamento Inteligente do Paciente",
    description:
      "O paciente localiza a especialidade ou exame pelo portal/WhatsApp Conecta Saúde e escolhe a data e horário desejados.",
  },
  {
    step: "03",
    title: "Envio da Guia Digital no WhatsApp",
    description:
      "O paciente recebe instantaneamente a guia com endereço, horário, orientações de preparo prévio e o QR Code de confirmação.",
  },
  {
    step: "04",
    title: "Atendimento & Recebimento no Balcão",
    description:
      "O paciente apresenta o QR Code no caixa da recepção, realiza o pagamento integral direto à clínica e segue para o atendimento.",
  },
];

type ProcedureSimulation = {
  category: string;
  procedure: string;
  counterPrice: number;
  partnerPrice: number;
  paymentType: string;
  feeLabel: string;
};

const procedureSimulations: ProcedureSimulation[] = [
  {
    category: "Consultas Especializadas",
    procedure: "Consulta Médica (Cardiologia / Ortopedia / Ginecologia)",
    counterPrice: 250,
    partnerPrice: 200,
    paymentType: "Direto no Balcão (Caixa da Clínica)",
    feeLabel: "Comissão de Sucesso",
  },
  {
    category: "Ultrassonografia",
    procedure: "Ultrassom Abdômen Total / Mamas / Obstétrica",
    counterPrice: 220,
    partnerPrice: 180,
    paymentType: "Direto no Balcão (Caixa da Clínica)",
    feeLabel: "Comissão de Sucesso",
  },
  {
    category: "Exames de Diagnóstico",
    procedure: "Ecocardiograma Transtorácico / Holter / ECG",
    counterPrice: 300,
    partnerPrice: 240,
    paymentType: "Direto no Balcão (Caixa da Clínica)",
    feeLabel: "Comissão de Sucesso",
  },
  {
    category: "Biópsias & Procedimentos",
    procedure: "Biópsia Guiada por USG (Tireoide / Mama / Próstata)",
    counterPrice: 650,
    partnerPrice: 520,
    paymentType: "Direto no Balcão (Caixa da Clínica)",
    feeLabel: "Comissão de Sucesso",
  },
  {
    category: "Cirurgias Ambulatoriais",
    procedure: "Vasectomia / Endoscopia / Cirurgia Dermatológica",
    counterPrice: 1400,
    partnerPrice: 1100,
    paymentType: "Direto no Balcão (Caixa da Clínica)",
    feeLabel: "Comissão de Sucesso",
  },
];

const guarantees = [
  { title: "Taxa de Adesão R$ 0,00", desc: "Nenhum valor cobrado para cadastrar a clínica, médicos e procedimentos." },
  { title: "Mensalidade R$ 0,00", desc: "Custo fixo zero. Você só é remunerado quando o paciente é atendido." },
  { title: "Sem Fidelidade ou Multa", desc: "Liberdade total para pausar ou encerrar a parceria a qualquer momento." },
  { title: "Conformidade LGPD", desc: "Dados clínicos e de pacientes criptografados e protegidos por padrão." },
];

export default function CommercialProposalPage() {
  const issueDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date());

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans print:bg-white text-slate-900">
      <ProposalActionBar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12 print:max-w-full print:p-0 print:shadow-none">
        {/* Document Container Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-12 shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none space-y-10">
          
          {/* Executive Header */}
          <header className="border-b border-slate-200/90 pb-8 space-y-6 print:pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/20 print:shadow-none">
                  <HeartPulse className="size-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold tracking-tight text-slate-900 block">
                    Conecta Saúde
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 font-mono">
                    Consultas & Exames • Vitória da Conquista
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <Sparkles className="size-3 text-emerald-600" />
                  Credenciamento Comercial 2026
                </span>
                <span className="text-xs font-mono text-slate-500 font-medium hidden sm:inline">
                  {issueDate}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Programa de Credenciamento e Parceria para Clínicas, Hospitais e Laboratórios
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
                Conectando pacientes particulares à sua estrutura com agilidade, liquidez imediata e tecnologia de ponta em Vitória da Conquista e toda a região sul da Bahia.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/60 print:bg-white">
              <span>Proposta desenvolvida pela <strong className="text-slate-800 font-bold">TIVDC Tecnologia</strong></span>
              <span>Modelo Comercial: <strong className="text-emerald-700 font-bold">Tabela Oficial de Marcadores (Risco Zero)</strong></span>
            </div>
          </header>

          {/* Business Model Highlight Box */}
          <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-emerald-50/70 p-5 sm:p-6 print:border-emerald-300 print:bg-emerald-50/20 print:break-inside-avoid">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 font-mono">
                  DIRETRIZ COMERCIAL CENTRAL
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Prática Direta da Tabela Oficial de Marcadores da Clínica
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
                  A Conecta Saúde opera diretamente com a tabela de parceiros/marcadores que a própria clínica já possui. Sem intermediação de recebíveis e sem risco financeiro.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 font-mono text-right">
                <span className="text-xs text-slate-500">Taxa de Adesão: <strong className="text-slate-900 font-bold">R$ 0,00</strong></span>
                <span className="text-xs text-slate-500">Mensalidade: <strong className="text-slate-900 font-bold">R$ 0,00</strong></span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-lg">
                  Remuneração 100% no Sucesso
                </span>
              </div>
            </div>
          </section>

          {/* 4 Pillars Section */}
          <section className="space-y-4 print:break-inside-avoid">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Os 4 Pilares da Parceria</h2>
              <p className="text-xs text-slate-500">Engenharia comercial desenhada para proteger a margem e a operação da clínica.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {pillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.title}
                    className={`rounded-2xl border p-5 bg-gradient-to-b ${pillar.color} transition-all print:bg-white print:border-slate-300 print:p-4`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-white shadow-2xs print:border print:border-slate-200">
                        <Icon className="size-5" />
                      </span>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-slate-200/60">
                        {pillar.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">{pillar.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Visual Operational Flow */}
          <section className="space-y-4 print:break-inside-avoid">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Fluxo Operacional em 4 Passos Visuais</h2>
              <p className="text-xs text-slate-500">Do cadastro da tabela ao atendimento no balcão da clínica.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {operationalFlow.map((flow) => (
                <div
                  key={flow.step}
                  className="relative rounded-2xl border border-slate-200/90 bg-white p-4 space-y-2 print:border-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      PASSO {flow.step}
                    </span>
                    <ArrowRight className="size-4 text-slate-300 hidden lg:block" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{flow.title}</h3>
                  <p className="text-xs text-slate-600 leading-normal">{flow.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Simulation Table */}
          <section className="space-y-4 print:break-inside-avoid">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Simulação de Tabela & Remuneração</h2>
                <p className="text-xs text-slate-500">
                  Exemplos de procedimentos reais praticados em Vitória da Conquista.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500 italic">
                *Valores de referência adaptáveis à tabela oficial de cada parceiro
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs print:border-slate-300">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 print:bg-slate-100">
                    <TableHead className="font-bold text-slate-800 text-xs">Procedimento / Categoria</TableHead>
                    <TableHead className="text-right font-bold text-slate-800 text-xs">Tabela Particular Balcão</TableHead>
                    <TableHead className="text-right font-bold text-emerald-800 text-xs">Tabela Oficial Marcador</TableHead>
                    <TableHead className="text-center font-bold text-slate-800 text-xs">Forma de Recebimento</TableHead>
                    <TableHead className="text-right font-bold text-slate-800 text-xs">Modelo Remuneração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {procedureSimulations.map((item) => (
                    <TableRow key={item.procedure} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                      <TableCell className="py-3">
                        <p className="font-bold text-slate-900 text-xs sm:text-sm">{item.procedure}</p>
                        <p className="text-[11px] font-mono text-slate-500">{item.category}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-400 line-through">
                        {formatCurrency(item.counterPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs sm:text-sm font-bold text-emerald-700">
                        {formatCurrency(item.partnerPrice)}
                      </TableCell>
                      <TableCell className="text-center text-xs text-slate-700 font-medium">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-800 border border-slate-200/60 print:bg-white print:border-slate-300">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          {item.paymentType}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-semibold text-slate-700">
                        {item.feeLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Included Technology Panel */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6 space-y-4 print:bg-white print:border-slate-300 print:break-inside-avoid">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Laptop className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Tecnologia Inclusa sem Custos</h3>
                <p className="text-xs text-slate-500">Painel web dedicado para a equipe de recepção da clínica (`/clinic`)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
              <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/60">
                <Smartphone className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Scanner de QR Code no Balcão</p>
                  <p className="text-slate-500">Validação instantânea das guias digitais na recepção em 2 segundos.</p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/60">
                <CalendarCheck className="size-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Gestão de Agenda em Tempo Real</p>
                  <p className="text-slate-500">Controle total sobre horários disponíveis e vagas de marcadores.</p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/60">
                <Receipt className="size-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Relatórios Transparentes</p>
                  <p className="text-slate-500">Extrato detalhado de atendimentos realizados e fechamento mensal.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Guarantees & Footer */}
          <section className="space-y-4 pt-2 print:break-inside-avoid">
            <h2 className="text-base font-bold text-slate-900">Garantias de Credenciamento Risco Zero</h2>
            
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {guarantees.map((g) => (
                <div key={g.title} className="rounded-xl border border-slate-200 p-3.5 space-y-1 bg-white print:border-slate-300">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Check className="size-4 text-emerald-600 shrink-0" />
                    <span>{g.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">{g.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Executive Sign-off Footer */}
          <footer className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500 print:pt-4">
            <div className="space-y-0.5 text-center sm:text-left">
              <p className="font-bold text-slate-800">Conecta Saúde — Plataforma de Agendamentos Médicos</p>
              <p>TIVDC Tecnologia • Vitória da Conquista — BA</p>
            </div>

            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span>Documento de Proposta Oficial • Validade 30 Dias</span>
            </div>
          </footer>

        </div>
      </main>
    </div>
  );
}

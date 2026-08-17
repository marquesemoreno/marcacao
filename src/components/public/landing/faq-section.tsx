import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, MessageCircle } from "lucide-react";

const faqs = [
  {
    question: "Preciso pagar alguma taxa ou mensalidade para usar a Conecta Saúde?",
    answer:
      "Não! A plataforma é 100% gratuita para o paciente. Você só paga o valor da consulta ou exame diretamente no balcão da clínica parceira no momento do atendimento, sem taxas ocultas, mensalidades ou contratos de fidelidade.",
  },
  {
    question: "Como funciona o pagamento no dia do atendimento?",
    answer:
      "O pagamento é feito diretamente na recepção da clínica parceira no dia da sua consulta ou exame. As clínicas credenciadas aceitam as principais formas de pagamento: PIX, cartão de crédito, débito ou dinheiro em espécie, com o valor com desconto garantido pela sua Guia Digital.",
  },
  {
    question: "Como recebo as instruções de preparo (como jejum) e a confirmação?",
    answer:
      "Assim que seu agendamento é processado, você recebe todas as orientações detalhadas de preparo (como tempo de jejum, se precisa beber água ou suspender remédios) e a Guia Oficial com QR Code direto no seu WhatsApp.",
  },
  {
    question: "Moro em outra cidade da região (como Planalto ou Barra do Choça), posso agendar?",
    answer:
      "Com certeza! A Conecta Saúde foi criada para atender pacientes de todo o Sudoeste Baiano. Você pode agendar em clínicas na sua própria cidade ou nos grandes centros médicos e diagnósticos de Vitória da Conquista.",
  },
  {
    question: "Preciso de pedido médico para agendar consultas e exames?",
    answer:
      "Para consultas médicas não é necessário pedido. Para exames laboratoriais ou de imagem de rotina, a maioria não exige pedido prévio para particulares, mas exames específicos ou com contraste podem requerer solicitação médica. As instruções completas aparecem na página de cada exame e na sua confirmação do WhatsApp.",
  },
  {
    question: "Como cancelar ou remarcar um agendamento?",
    answer:
      "Basta responder a mensagem de confirmação que você recebeu no WhatsApp escolhendo a opção de cancelamento ou reagendamento, ou entrar em contato direto pelo canal de suporte com até 2 horas de antecedência.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="relative bg-white py-20 lg:py-28 border-t border-slate-200/70">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-4 py-1.5 text-xs font-semibold text-teal-800 shadow-sm">
            <HelpCircle className="size-3.5 text-teal-600" />
            <span>Tire suas dúvidas</span>
          </div>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Perguntas Frequentes
          </h2>
          
          <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-xl mx-auto">
            Tudo o que você precisa saber sobre valores, agendamentos, pagamento e atendimento na Conecta Saúde.
          </p>
        </div>

        {/* Accordion Container */}
        <div className="mt-12">
          <Accordion className="flex flex-col gap-4">
            {faqs.map(({ question, answer }, index) => (
              <AccordionItem
                key={question}
                value={`faq-${index}`}
                className="rounded-2xl border border-slate-200/80 bg-white px-5 sm:px-6 py-1 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md data-[state=open]:border-teal-500/40 data-[state=open]:bg-slate-50/40 data-[state=open]:shadow-md"
              >
                <AccordionTrigger className="py-4 text-left text-base font-bold text-slate-900 hover:text-teal-700 hover:no-underline transition-colors">
                  <span className="flex items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-800">
                      {index + 1}
                    </span>
                    <span>{question}</span>
                  </span>
                </AccordionTrigger>
                
                <AccordionContent className="pb-5 pt-1 text-sm sm:text-base text-slate-600 leading-relaxed pl-9">
                  {answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* WhatsApp Help Footer Card */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-6 sm:p-7 shadow-sm">
          <div className="flex items-center gap-4 text-left">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <MessageCircle className="size-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Ainda ficou com alguma dúvida?</h4>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Nossa equipe de suporte atende você no WhatsApp com atendimento humanizado.
              </p>
            </div>
          </div>

          <a
            href="https://wa.me/5577999999999?text=Olá,%20gostaria%20de%20tirar%20uma%20dúvida%20sobre%20a%20Conecta%20Saúde"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-all shrink-0 w-full sm:w-auto"
          >
            Falar no WhatsApp
            <span>→</span>
          </a>
        </div>

      </div>
    </section>
  );
}

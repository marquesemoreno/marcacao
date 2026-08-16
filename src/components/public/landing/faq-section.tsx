import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Preciso pagar antes de ser atendido?",
    answer:
      "Não. Você só reserva o horário pelo nosso site — o pagamento é feito direto na clínica, no dia do atendimento, na forma combinada com ela (dinheiro, cartão ou Pix).",
  },
  {
    question: "Como recebo a confirmação do meu agendamento?",
    answer:
      "Assim que a clínica confirma sua solicitação, você recebe uma mensagem automática no WhatsApp com todos os detalhes: data, horário, endereço e instruções de preparo, se houver.",
  },
  {
    question: "Preciso de pedido médico para fazer exames?",
    answer:
      "Depende do exame e da clínica. Alguns exames exigem pedido médico, outros não. Consulte as instruções na página do exame antes de agendar, ou fale direto com a clínica.",
  },
  {
    question: "Como as clínicas confirmam minha consulta?",
    answer:
      "A equipe da clínica analisa sua solicitação pelo painel dela e confirma o horário — você recebe a confirmação automaticamente pelo WhatsApp, sem precisar ligar ou esperar.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Perguntas frequentes</h2>
          <p className="mt-3 text-slate-600">Tudo o que você precisa saber antes de agendar.</p>
        </div>

        <Accordion className="mt-8">
          {faqs.map(({ question, answer }) => (
            <AccordionItem key={question} value={question} className="border-slate-200">
              <AccordionTrigger className="py-4 text-base font-semibold text-slate-900 hover:no-underline">
                {question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600">{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

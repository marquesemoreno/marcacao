export const metadata = {
  title: "Termos de Uso | Marcação",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Termos de Uso</h1>
      <p className="mt-2 text-sm text-slate-500">Última atualização: {new Date().getFullYear()}</p>

      <div className="mt-8 flex flex-col gap-6 text-sm text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Sobre a plataforma</h2>
          <p className="mt-2">
            O Marcação é uma plataforma de agendamento que conecta pacientes a clínicas parceiras
            para consultas e exames. Não somos um prestador de serviços de saúde: a
            responsabilidade pelo atendimento, diagnóstico e tratamento é sempre da clínica
            escolhida.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Agendamentos</h2>
          <p className="mt-2">
            A solicitação de agendamento feita pelo site é uma reserva de horário, sujeita à
            confirmação da clínica. O pagamento do procedimento é feito diretamente à clínica, na
            forma combinada com ela — o Marcação não processa nem intermedia pagamentos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Comunicação por WhatsApp</h2>
          <p className="mt-2">
            Ao agendar, você concorda em receber mensagens automáticas via WhatsApp sobre o status
            do seu agendamento (confirmação, lembretes, cancelamento). Essas mensagens são
            operacionais e não incluem marketing.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Cancelamentos</h2>
          <p className="mt-2">
            Cancelamentos e reagendamentos seguem a política de cada clínica parceira. Entre em
            contato com a clínica diretamente para alterar um horário já confirmado.
          </p>
        </section>
      </div>
    </main>
  );
}

export const metadata = {
  title: "Exclusão de Dados | Conecta Saúde",
};

/** Instruções de exclusão de dados — exigidas pela Meta no cadastro do app (Configurações >
 * Básico > "Exclusão de dados do usuário") e pela LGPD. */
export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Como solicitar a exclusão dos seus dados</h1>
      <p className="mt-2 text-sm text-slate-500">Conecta Saúde · TIVDC Tecnologia da Informação</p>

      <div className="mt-8 flex flex-col gap-6 text-sm text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Quais dados guardamos</h2>
          <p className="mt-2">
            Quando você conversa com uma clínica parceira pelo WhatsApp ou faz um agendamento pelo Conecta Saúde, guardamos
            seu nome, telefone, as mensagens trocadas com a clínica e os dados do agendamento, para que a clínica possa
            atender você.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Como pedir a exclusão</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Envie um e-mail para{" "}
              <a href="mailto:contato@conectasaudevc.com.br" className="underline">
                contato@conectasaudevc.com.br
              </a>{" "}
              com o assunto <strong>&quot;Exclusão de dados&quot;</strong>.
            </li>
            <li>Informe o número de telefone (WhatsApp) usado para falar com a clínica e o nome da clínica.</li>
            <li>Podemos pedir uma confirmação pelo próprio WhatsApp para garantir que o pedido é seu.</li>
          </ol>
          <p className="mt-2">
            Você também pode pedir diretamente para a clínica, pelo mesmo WhatsApp em que conversou com ela.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">O que acontece depois</h2>
          <p className="mt-2">
            Em até 15 dias excluímos suas mensagens, seus dados de contato e o histórico de atendimento do Conecta Saúde e
            confirmamos por e-mail. Informações que a clínica é obrigada por lei a manter (por exemplo, registros de
            atendimento em saúde) continuam sob responsabilidade da clínica, conforme a legislação.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Mais informações</h2>
          <p className="mt-2">
            Veja também a nossa{" "}
            <a href="/privacidade" className="underline">
              Política de Privacidade
            </a>{" "}
            e os{" "}
            <a href="/termos" className="underline">
              Termos de Uso
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

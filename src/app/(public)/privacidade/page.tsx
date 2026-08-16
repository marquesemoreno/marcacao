export const metadata = {
  title: "Política de Privacidade | Conecta Saúde",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-slate-500">Última atualização: {new Date().getFullYear()}</p>

      <div className="mt-8 flex flex-col gap-6 text-sm text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Quais dados coletamos</h2>
          <p className="mt-2">
            Para viabilizar um agendamento, coletamos nome, CPF e telefone/WhatsApp informados no
            momento da solicitação. Esses dados são compartilhados apenas com a clínica escolhida,
            para que ela possa confirmar e realizar o atendimento.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Como usamos seus dados</h2>
          <p className="mt-2">
            Usamos seus dados exclusivamente para processar o agendamento, enviar confirmações e
            lembretes pelo WhatsApp, e permitir que você acompanhe o status da sua solicitação.
            Não vendemos nem compartilhamos seus dados com terceiros para fins de marketing.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Seus direitos (LGPD)</h2>
          <p className="mt-2">
            Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode solicitar
            a qualquer momento a confirmação, correção ou exclusão dos seus dados, entrando em
            contato pelo e-mail{" "}
            <a href="mailto:contato@conectasaudevdc.com.br" className="underline">
              contato@conectasaudevdc.com.br
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Retenção e segurança</h2>
          <p className="mt-2">
            Seus dados ficam armazenados de forma segura pelo tempo necessário para viabilizar o
            atendimento e cumprir obrigações legais das clínicas parceiras, com acesso restrito à
            equipe autorizada.
          </p>
        </section>
      </div>
    </main>
  );
}

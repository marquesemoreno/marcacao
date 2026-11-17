/** Guia/comprovante com link antigo, alterado ou vencido (auditoria M11). */
export function GuideLinkUnavailable({ expired }: { expired: boolean }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">{expired ? "Este link expirou" : "Link inválido"}</h1>
      <p className="text-sm text-slate-600">
        {expired
          ? "A guia fica disponível até 7 dias depois da consulta. Se precisar dela, peça à clínica pelo WhatsApp."
          : "Não encontramos esta guia. Confira se o link está completo ou peça um novo à clínica pelo WhatsApp."}
      </p>
    </main>
  );
}

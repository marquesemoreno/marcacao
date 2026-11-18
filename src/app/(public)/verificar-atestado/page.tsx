import { verifyCertificateCode } from "@/lib/lgpd-certificate-server";
import { brasiliaDateTime } from "@/lib/lgpd-certificate";

export const metadata = { title: "Verificar atestado | Conecta Saúde" };
export const dynamic = "force-dynamic";

/** Conferência pública do atestado de anonimização: diz só se o código vale, de qual clínica,
 * quando e o protocolo. Nenhum dado do titular. */
export default async function VerifyCertificatePage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  const result = codigo ? await verifyCertificateCode(codigo.slice(0, 40)) : null;

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verificar atestado de anonimização</h1>
      <p className="mt-2 text-sm text-slate-600">Digite o código de autenticidade que está no fim do atestado.</p>
      <form method="get" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="codigo" className="sr-only">
          Código de autenticidade
        </label>
        <input
          id="codigo"
          name="codigo"
          defaultValue={codigo ?? ""}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
          maxLength={40}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 font-mono text-sm uppercase"
        />
        <button type="submit" className="h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
          Verificar
        </button>
      </form>
      {result && (
        <div
          role="status"
          className={`mt-6 rounded-lg border p-4 text-sm ${result.valid ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}
        >
          {result.valid ? (
            <>
              <p className="font-semibold">Atestado válido.</p>
              <p className="mt-1">Clínica: {result.clinicName}</p>
              <p>Executado em: {brasiliaDateTime(result.performedAt)} (horário de Brasília)</p>
              <p>Protocolo: {result.protocol}</p>
            </>
          ) : (
            <p className="font-semibold">Código não encontrado ou atestado alterado. Confira se digitou certo.</p>
          )}
        </div>
      )}
    </main>
  );
}

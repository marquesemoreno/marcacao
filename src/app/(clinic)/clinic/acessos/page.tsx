import Link from "next/link";
import { PageHeader } from "@/components/clinic/page-header";
import { ManagerOnly, currentUserIsManager } from "@/components/clinic/manager-only";
import { listPatientAccess, listClinicUsersForAccess } from "@/actions/access-log";
import { formatPhone } from "@/lib/format";

export const metadata = { title: "Acessos" };
export const dynamic = "force-dynamic";

/** Quem acessou dados de qual paciente (LGPD) — só gestão. */
export default async function AccessLogPage({ searchParams }: { searchParams: Promise<{ q?: string; usuario?: string }> }) {
  if (!(await currentUserIsManager())) return <ManagerOnly />;
  const params = await searchParams;
  const [rows, users] = await Promise.all([listPatientAccess({ q: params.q, userId: params.usuario }), listClinicUsersForAccess()]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-5 p-4 sm:p-6 max-w-5xl">
        <PageHeader title="Acessos a pacientes" subtitle="Quem abriu a conversa, abriu a ficha ou editou o cadastro de cada paciente." />
        <form className="flex flex-wrap items-end gap-2" action="/clinic/acessos">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Paciente (nome ou telefone)
            <input name="q" defaultValue={params.q ?? ""} className="mt-1 block h-9 w-64 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Usuário
            <select name="usuario" defaultValue={params.usuario ?? ""} className="mt-1 block h-9 w-52 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm">
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-9 rounded-md bg-slate-900 dark:bg-slate-100 px-4 text-sm font-semibold text-white dark:text-slate-900">
            Filtrar
          </button>
          {(params.q || params.usuario) && (
            <Link href="/clinic/acessos" className="h-9 inline-flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 underline underline-offset-2">
              Limpar
            </Link>
          )}
        </form>
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {rows.length === 0 ? (
            <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Nenhum acesso registrado com esses filtros. O registro começou em 20/10/2026.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400">
                  <th className="py-2 pl-4 pr-3 text-left font-medium">Quando</th>
                  <th className="px-3 text-left font-medium">Usuário</th>
                  <th className="px-3 text-left font-medium">Paciente</th>
                  <th className="pr-4 pl-3 text-left font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pl-4 pr-3 tabular-nums text-slate-600 dark:text-slate-400">{fmt.format(new Date(r.at))}</td>
                    <td className="px-3">{r.user}</td>
                    <td className="px-3">
                      <Link href={`/clinic/pacientes/${r.conversationId}`} className="hover:underline underline-offset-2">
                        {r.patient}
                      </Link>
                      {r.phone && <span className="ml-1.5 text-xs text-slate-500">{formatPhone(r.phone)}</span>}
                    </td>
                    <td className="pr-4 pl-3">{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Abrir a mesma conversa ou ficha várias vezes na mesma hora conta uma vez só. Edições contam sempre. Mostra os 300 registros mais recentes.
        </p>
      </div>
    </div>
  );
}

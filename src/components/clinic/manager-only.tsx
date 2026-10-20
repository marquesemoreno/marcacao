import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { isClinicManager } from "@/lib/session";

/** Usuário logado tem papel de gestão na clínica? */
export async function currentUserIsManager(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return session?.user.id ? isClinicManager(session.user.id) : false;
}

/** Tela para quem é recepção e abre um endereço só da gestão (Relatórios, Configurações). */
export function ManagerOnly() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-2">
        <Lock className="mx-auto h-6 w-6 text-slate-400" aria-hidden />
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Área da gestão da clínica</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Relatórios e configurações ficam disponíveis só para quem tem acesso de gestão. Se precisar, peça à gestão da clínica.
        </p>
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getClinicRole, isClinicManager } from "@/lib/session";
import { can, type ClinicPermission } from "@/lib/clinic-permissions";

/** Usuário logado tem papel de gestão na clínica? */
export async function currentUserIsManager(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return session?.user.id ? isClinicManager(session.user.id) : false;
}

/** Usuário logado tem esta permissão (tabela de funções)? */
export async function currentUserCan(permission: ClinicPermission): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return session?.user.id ? can(await getClinicRole(session.user.id), permission) : false;
}

/** Tela para quem é recepção e abre um endereço só da gestão (Relatórios, Configurações). */
export function ManagerOnly() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-2">
        <Lock className="mx-auto h-6 w-6 text-slate-400" aria-hidden />
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Área restrita pela sua função</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Esta tela não faz parte da sua função na clínica (Recepção, Marketing ou Gestão). Se precisar, peça à gestão da clínica.
        </p>
      </div>
    </div>
  );
}

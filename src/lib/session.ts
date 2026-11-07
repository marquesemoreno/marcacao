import { cache } from "react";
import { getServerSession } from "next-auth";
import { sessionStillValid } from "@/lib/auth-security";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, parseClinicRole, type ClinicPermission, type ClinicRole } from "@/lib/clinic-permissions";

/** Usuário lido 1x por requisição (cache do React) — ativo, versão da sessão e função. */
const loadUser = cache((id: string) =>
  prisma.user.findUnique({ where: { id }, select: { active: true, sessionVersion: true, clinicRole: true } })
);

/** Sessão ainda vale? Cai na hora se o usuário foi desativado, trocou a senha ou teve as
 * sessões encerradas (sessionVersion subiu). */
export async function isLive(session: { user: { id: string; sessionVersion?: number } }) {
  return sessionStillValid(session.user.sessionVersion, await loadUser(session.user.id));
}

async function clinicSessionBase() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLINIC" || !session.user.clinicId || !(await isLive(session))) {
    throw new Error("Não autorizado");
  }
  return { userId: session.user.id, clinicId: session.user.clinicId };
}

/** Sessão da equipe da clínica. A função Médico NÃO passa aqui: o login do médico só usa
 * as ações com requireClinicPermission("chamar") (tela Meus pacientes). */
export async function requireClinicSession() {
  const s = await clinicSessionBase();
  if ((await getClinicRole(s.userId)) === "MEDICO") throw new Error("Não autorizado");
  return s;
}

/** Sessão de clínica, ou null (admin / deslogado) — para leituras que só fazem sentido no
 * painel da clínica e não devem virar erro no servidor quando o admin abre a mesma tela. */
export async function getClinicSessionOrNull() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLINIC" || !session.user.clinicId || !(await isLive(session))) return null;
  if ((await getClinicRole(session.user.id)) === "MEDICO") return null;
  return { userId: session.user.id, clinicId: session.user.clinicId };
}

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN" || !(await isLive(session))) {
    throw new Error("Não autorizado");
  }
  return { userId: session.user.id };
}

/** Usuário da clínica com papel de gestão (User.isManager)? Lido do banco a cada chamada —
 * o admin liga/desliga e vale na hora, sem precisar sair e entrar de novo. */
export async function isClinicManager(userId: string): Promise<boolean> {
  return (await getClinicRole(userId)) === "GESTAO";
}

/** Função do usuário (lida do banco a cada chamada — troca vale na hora). */
export async function getClinicRole(userId: string): Promise<ClinicRole> {
  return parseClinicRole((await loadUser(userId))?.clinicRole);
}

/** Sessão da clínica com a permissão pedida (tabela em clinic-permissions.ts). */
export async function requireClinicPermission(permission: ClinicPermission) {
  const session = await clinicSessionBase();
  if (!can(await getClinicRole(session.userId), permission)) throw new Error("Acesso restrito pela sua função na clínica");
  return session;
}

/** Como requireClinicSession, mas só para gestão: Relatórios e Configurações (auditoria de
 * saúde, 19/10 — antes qualquer login da clínica via e mudava tudo). */
export async function requireClinicManager() {
  const session = await requireClinicSession();
  if (!(await isClinicManager(session.userId))) throw new Error("Acesso restrito à gestão da clínica");
  return session;
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireClinicSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLINIC" || !session.user.clinicId) {
    throw new Error("Não autorizado");
  }
  return { userId: session.user.id, clinicId: session.user.clinicId };
}

/** Sessão de clínica, ou null (admin / deslogado) — para leituras que só fazem sentido no
 * painel da clínica e não devem virar erro no servidor quando o admin abre a mesma tela. */
export async function getClinicSessionOrNull() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLINIC" || !session.user.clinicId) return null;
  return { userId: session.user.id, clinicId: session.user.clinicId };
}

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Não autorizado");
  }
  return { userId: session.user.id };
}

/** Usuário da clínica com papel de gestão (User.isManager)? Lido do banco a cada chamada —
 * o admin liga/desliga e vale na hora, sem precisar sair e entrar de novo. */
export async function isClinicManager(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isManager: true } });
  return Boolean(user?.isManager);
}

/** Como requireClinicSession, mas só para gestão: Relatórios e Configurações (auditoria de
 * saúde, 19/10 — antes qualquer login da clínica via e mudava tudo). */
export async function requireClinicManager() {
  const session = await requireClinicSession();
  if (!(await isClinicManager(session.userId))) throw new Error("Acesso restrito à gestão da clínica");
  return session;
}

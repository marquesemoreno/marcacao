/** Proteção do login (auditoria de saúde, 19/10): o painel mostra dado de paciente e roda
 * em computador compartilhado de recepção. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MIN = 15;
/** Sessão de um turno — antes era o padrão do NextAuth (30 dias). */
export const SESSION_MAX_AGE_SEC = 12 * 60 * 60;

/** Bloqueado se houve LOGIN_MAX_FAILURES senhas erradas na janela de LOGIN_WINDOW_MIN. */
export function isLoginLocked(recentFailures: Date[], now: Date = new Date()): boolean {
  const since = now.getTime() - LOGIN_WINDOW_MIN * 60_000;
  return recentFailures.filter((d) => d.getTime() >= since).length >= LOGIN_MAX_FAILURES;
}

/** Limite por origem (auditoria de segurança 16/11/2026, M10). O bloqueio por e-mail não
 * segura quem testa UMA senha comum contra muitos e-mails; este conta os erros de senha ou
 * de código vindos do mesmo IP na mesma janela de LOGIN_WINDOW_MIN. 20 dá folga para uma
 * recepção inteira atrás do mesmo Wi-Fi errar a senha de manhã. */
export const LOGIN_MAX_FAILURES_PER_IP = 20;

export function isIpLocked(recentFailuresFromIp: number): boolean {
  return recentFailuresFromIp >= LOGIN_MAX_FAILURES_PER_IP;
}

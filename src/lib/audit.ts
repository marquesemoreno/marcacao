/** Auditoria de alterações (LGPD): quem mudou o quê, com antes/depois só dos campos que
 * mudaram. Leituras de dados de paciente seguem em PatientAccessLog. Puro — o gravador
 * fica em audit-server.ts. */
export type AuditChange = { from: unknown; to: unknown };

/** Nunca em claro no log, mesmo mudando. */
const SENSITIVE = new Set(["cpf", "rg", "birthDate", "nascimento", "answers", "password", "passwordHash", "token"]);

export function auditDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Record<string, AuditChange> {
  const out: Record<string, AuditChange> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    const from = before?.[k] ?? null;
    const to = after?.[k] ?? null;
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    out[k] = SENSITIVE.has(k) ? { from: from === null ? null : "[alterado]", to: to === null ? null : "[alterado]" } : { from, to };
  }
  return out;
}

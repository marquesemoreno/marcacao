/** Exclusão a pedido do titular (LGPD) — partes puras. */
export const ANONYMIZED_NAME = "Paciente (dados excluídos)";

/** Telefone mascarado pro registro da exclusão (prova de que foi feito, sem o dado). */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  return `${d.slice(0, 2)} ${d.slice(2, 4)} *****-**${d.slice(-2)}`;
}

/** Formas em que o mesmo telefone aparece nas tabelas (o Contact guarda 55+DDD+número; fila
 * de senhas, lista de espera, agendamentos e aceites de SMS guardam sem o 55; cadastros
 * antigos, sem o 9º dígito). Usado para achar tudo do titular na hora de excluir. */
export function phoneVariants(phone: string | null | undefined): string[] {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return [];
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const ddd = national.slice(0, 2);
  const number = national.slice(2);
  const numbers = new Set([number]);
  if (number.length === 9 && number.startsWith("9")) numbers.add(number.slice(1));
  if (number.length === 8) numbers.add(`9${number}`);
  return [...numbers].flatMap((n) => [`55${ddd}${n}`, `${ddd}${n}`]);
}

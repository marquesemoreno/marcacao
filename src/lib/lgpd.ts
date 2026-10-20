/** Exclusão a pedido do titular (LGPD) — partes puras. */
export const ANONYMIZED_NAME = "Paciente (dados excluídos)";

/** Telefone mascarado pro registro da exclusão (prova de que foi feito, sem o dado). */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  return `${d.slice(0, 2)} ${d.slice(2, 4)} *****-**${d.slice(-2)}`;
}

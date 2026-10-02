import { isValidCpf } from "./cpf";

/** Dados opcionais do "Novo Contato" (F2, seção "Mais dados"). */
export type NewContactExtra = { cpf?: string; birthDate?: string; convenio?: string };

/** Valida/normaliza no servidor e devolve só os campos preenchidos — nunca sobrescreve
 * dado que o contato (compartilhado entre clínicas) já tinha. */
export function parseNewContactExtra(
  extra: NewContactExtra | undefined,
  existing?: { cpf: string | null; birthDate: Date | null; convenio: string | null }
) {
  const data: { cpf?: string; birthDate?: Date; convenio?: string } = {};
  const cpf = extra?.cpf?.replace(/\D/g, "");
  if (cpf) {
    if (!isValidCpf(cpf)) throw new Error("CPF inválido.");
    if (!existing?.cpf) data.cpf = cpf;
  }
  if (extra?.birthDate) {
    const d = new Date(`${extra.birthDate}T12:00:00Z`);
    if (isNaN(d.getTime()) || d > new Date() || d.getUTCFullYear() < 1900) throw new Error("Data de nascimento inválida.");
    if (!existing?.birthDate) data.birthDate = d;
  }
  const convenio = extra?.convenio?.trim().slice(0, 80);
  if (convenio && !existing?.convenio) data.convenio = convenio;
  return data;
}

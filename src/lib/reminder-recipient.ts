import { isMinor } from "./minor";

/** Para quem vai o lembrete (auditoria de saúde, item 10): paciente menor de idade com
 * responsável legal cadastrado na ficha da clínica → telefone do responsável. */
export function reminderRecipient(
  input: { patientPhone: string; birthDate: Date | null; guardianName: string | null; guardianPhone: string | null },
  now: Date = new Date()
): { phone: string; toGuardian: boolean; guardianFirstName: string | null } {
  const minor = input.birthDate ? isMinor(input.birthDate.toISOString().slice(0, 10), now) : false;
  if (minor && input.guardianPhone?.trim()) {
    return { phone: input.guardianPhone.trim(), toGuardian: true, guardianFirstName: input.guardianName?.trim().split(/\s+/)[0] || null };
  }
  return { phone: input.patientPhone, toGuardian: false, guardianFirstName: null };
}

/** Linha de abertura quando o lembrete vai para o responsável. */
export function guardianReminderIntro(guardianFirstName: string | null, patientName: string): string {
  return `Olá${guardianFirstName ? `, ${guardianFirstName}` : ""}! Este lembrete é da consulta de *${patientName}*, que tem você como responsável.`;
}

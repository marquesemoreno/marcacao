/** Paciente menor de idade (auditoria de saúde, item 10): a ficha pede responsável legal. */
export function ageFrom(birthDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = now.getUTCFullYear() - y;
  const beforeBirthday = now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (beforeBirthday) age--;
  return age;
}

export function isMinor(birthDate: string | null | undefined, now: Date = new Date()): boolean {
  const age = ageFrom(birthDate, now);
  return age !== null && age < 18;
}

/** Valida CPF pelo algoritmo oficial de dígito verificador — rejeita sequências
 * repetidas (111.111.111-11 etc, sempre inválidas) e números com dígito errado,
 * não só a contagem de 11 dígitos. */
export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (base: string, factor: number) => {
    let sum = 0;
    for (const char of base) {
      sum += Number(char) * factor;
      factor -= 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const digit1 = calcDigit(digits.slice(0, 9), 10);
  if (digit1 !== Number(digits[9])) return false;

  const digit2 = calcDigit(digits.slice(0, 10), 11);
  if (digit2 !== Number(digits[10])) return false;

  return true;
}

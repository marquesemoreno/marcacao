import { detectDelimiter } from "@/lib/broadcast-csv";

/** Funções puras (cliente e servidor) dos canais de disparo além do WhatsApp: SMS e
 * e-mail. O envio em si fica em comtele.ts / resend.ts; a regra de quem pode receber,
 * em channel-consent.ts. */
export type BroadcastChannel = "WHATSAPP" | "SMS" | "EMAIL";
export type ParsedEmailRecipient = { email: string; variables: Record<string, string> };

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** Créditos de SMS consumidos: até 160 caracteres = 1; acima disso a Comtele cobra 1 a
 * cada 153 (SMS concatenado). */
export function smsCredits(text: string): number {
  if (text.length === 0) return 0;
  return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
}

/** Número de celular no formato 55 + DDD + 9 dígitos, ou null se não der pra mandar SMS
 * (fixo, curto demais, lixo). Celular antigo de 8 dígitos ganha o 9, como no WhatsApp
 * (formatToWhatsAppNumber em whatsapp.ts). */
export function toSmsNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  let national: string;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) national = digits.slice(2);
  else if (digits.length === 10 || digits.length === 11) national = digits;
  else return null;

  const ddd = national.slice(0, 2);
  let number = national.slice(2);
  if (ddd.startsWith("0")) return null;
  if (number.length === 8) {
    if (!/^[6-9]/.test(number)) return null; // 2–5 = telefone fixo
    number = `9${number}`;
  } else if (number[0] !== "9") {
    return null;
  }
  return `55${ddd}${number}`;
}

const EMAIL_CSV_DEFAULT_HEADERS = ["email", "nome", "procedimento", "data"];
const isEmailHeader = (h: string) => h === "email" || h === "e-mail";

/** CSV de campanha por e-mail: coluna "email" (ou "e-mail"); as outras viram variáveis do
 * texto. Sem cabeçalho, vale a ordem email,nome,procedimento,data. Não valida o endereço
 * (isso é feito ao criar a campanha, pra mostrar quantos foram recusados). */
export function parseEmailCsv(csv: string): ParsedEmailRecipient[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const firstRowCells = lines[0].split(delimiter).map((c) => c.trim());
  const firstRowLower = firstRowCells.map((c) => c.toLowerCase());
  const hasExplicitHeader = firstRowLower.some(isEmailHeader);

  if (!hasExplicitHeader && !firstRowCells.some((c) => c.includes("@"))) {
    throw new Error('CSV precisa de uma coluna "email" ou "e-mail".');
  }

  const headers = hasExplicitHeader
    ? firstRowLower
    : firstRowCells.map((_, index) => EMAIL_CSV_DEFAULT_HEADERS[index] ?? `coluna${index + 1}`);
  const dataLines = hasExplicitHeader ? lines.slice(1) : lines;
  const emailIndex = headers.findIndex(isEmailHeader);

  return dataLines.map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim());
    const variables: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (index !== emailIndex && cells[index]) variables[header] = cells[index];
    });
    return { email: normalizeEmail(cells[emailIndex] ?? ""), variables };
  });
}

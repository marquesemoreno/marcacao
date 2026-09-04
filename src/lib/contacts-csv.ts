/** Função pura (sem prisma/env) — roda tanto no cliente (preview antes de
 * confirmar a importação) quanto no servidor. Mesmo padrão de
 * src/lib/broadcast-csv.ts, adaptado pra nome/telefone/cpf em vez de
 * telefone/variáveis de template. */

export type ParsedContactRow = { name: string; phone: string; cpf?: string };

/** Ordem assumida quando o CSV não tem cabeçalho. */
const DEFAULT_HEADERS = ["nome", "telefone", "cpf"];

/** Excel/Sheets em pt-BR exporta CSV com ; (porque , é separador decimal) — detecta
 * pela linha que tiver mais ocorrências, em vez de assumir vírgula sempre. */
function detectDelimiter(firstLine: string): "," | ";" {
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

/** Parser simples de CSV (vírgula ou ponto-e-vírgula, autodetectado). Cabeçalho é
 * opcional: se a 1ª linha não tiver uma célula reconhecida (nome/name ou
 * telefone/celular/phone), trata a linha como dado e assume DEFAULT_HEADERS por
 * posição. Não normaliza o telefone (dígitos crus) — isso fica pro servidor
 * (formatToWhatsAppNumber), já que esse módulo também roda no cliente. Linhas
 * sem nome ou sem telefone são descartadas silenciosamente (célula vazia, ou
 * linha em branco). */
export function parseContactsCsv(csv: string): ParsedContactRow[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const firstRowCells = lines[0].split(delimiter).map((c) => c.trim());
  const firstRowLower = firstRowCells.map((c) => c.toLowerCase());
  const hasExplicitHeader = firstRowLower.some(
    (h) => h === "nome" || h === "name" || h === "telefone" || h === "celular" || h === "phone"
  );

  const headers = hasExplicitHeader
    ? firstRowLower
    : firstRowCells.map((_, index) => DEFAULT_HEADERS[index] ?? `coluna${index + 1}`);
  const dataLines = hasExplicitHeader ? lines.slice(1) : lines;

  const nameIndex = headers.findIndex((h) => h === "nome" || h === "name");
  const phoneIndex = headers.findIndex((h) => h === "telefone" || h === "celular" || h === "phone");
  const cpfIndex = headers.findIndex((h) => h === "cpf");

  if (nameIndex === -1) throw new Error('CSV precisa de uma coluna "nome" ou "name".');
  if (phoneIndex === -1) throw new Error('CSV precisa de uma coluna "telefone", "celular" ou "phone".');

  return dataLines
    .map((line) => {
      const cells = line.split(delimiter).map((c) => c.trim());
      const name = cells[nameIndex] ?? "";
      const phone = cells[phoneIndex] ?? "";
      const cpf = cpfIndex !== -1 ? cells[cpfIndex] : undefined;
      return { name, phone, cpf: cpf || undefined };
    })
    .filter((row) => row.name && row.phone);
}

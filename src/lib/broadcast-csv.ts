/** Funções puras (sem prisma/env) — podem rodar tanto no cliente (preview do CSV antes
 * de criar a campanha) quanto no servidor. Ver src/lib/broadcast.ts pro envio em si. */

export type ParsedBroadcastRecipient = { phone: string; variables: Record<string, string> };

/** Substitui {{qualquerColuna}} pelo valor correspondente em `vars` — diferente do
 * applyMessageVariables (src/lib/format.ts), que só cobre 4 nomes fixos, porque aqui
 * as colunas vêm de um CSV arbitrário que o admin sobe pra cada campanha. */
export function applyBroadcastVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key] ?? vars[key.toLowerCase()];
    return value ?? match;
  });
}

/** Linha de opt-out (LGPD) acrescentada em toda mensagem de campanha — reaproveita o
 * mecanismo de opt-out já tratado no webhook (route.ts) pra desligar
 * Contact.optedOutOfBroadcastsAt. Texto automático, não botão interativo: WhatsApp
 * bloqueia/penaliza mensagem com botão vinda de cliente não-oficial (Evolution/Baileys).
 * "9" em vez de "1"/"2" de propósito: esses dois já significam confirmar/cancelar
 * consulta no fluxo de lembrete de agendamento (resolveStatusFromReply). */
export const BROADCAST_OPT_OUT_FOOTER = "Digite *9* para não receber mais avisos.";

/** Reconhece a resposta de opt-out de disparo em massa — "9", "sair" ou "parar"
 * (trim + case-insensitive). Nunca usa "1"/"2" (ver BROADCAST_OPT_OUT_FOOTER) nem
 * "cancelar" sozinho (já significa "cancelar consulta" no mesmo fluxo de reply). */
export function isBroadcastOptOutReply(text: string): boolean {
  return /^(9|sair|parar)$/i.test(text.trim());
}

/** Monta o texto final enviado ao destinatário: aplica as variáveis do CSV e acrescenta
 * o rodapé de opt-out (a menos que já esteja presente no template). */
export function buildBroadcastMessage(template: string, vars: Record<string, string>): string {
  const withVariables = applyBroadcastVariables(template, vars);
  if (withVariables.includes(BROADCAST_OPT_OUT_FOOTER)) return withVariables;
  return `${withVariables}\n\n${BROADCAST_OPT_OUT_FOOTER}`;
}

/** Ordem assumida quando o CSV não tem cabeçalho — mesmo exemplo mostrado no formulário
 * de "Nova campanha" (telefone,nome,procedimento), pra colar sem cabeçalho já funcionar. */
const DEFAULT_HEADERS = ["telefone", "nome", "procedimento", "data"];

/** Excel/Sheets em pt-BR exporta CSV com ; (porque , é separador decimal) — detecta
 * pela linha que tiver mais ocorrências, em vez de assumir vírgula sempre. */
function detectDelimiter(firstLine: string): "," | ";" {
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

/** Parser simples de CSV (vírgula ou ponto-e-vírgula, autodetectado) — formato
 * controlado pelo admin que sobe o arquivo, sem precisar de lib externa. Cabeçalho é
 * opcional: se a 1ª linha não tiver uma célula "telefone"/"phone", trata a linha como
 * dado (não cabeçalho) e assume DEFAULT_HEADERS por posição. Com cabeçalho, qualquer
 * coluna além de telefone/phone vira variável do template; sem cabeçalho, viram
 * nome/procedimento/data por posição. Não normaliza o telefone (dígitos crus) — isso
 * fica pro servidor (formatToWhatsAppNumber), já que esse módulo também roda no cliente. */
export function parseBroadcastCsv(csv: string): ParsedBroadcastRecipient[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const firstRowCells = lines[0].split(delimiter).map((c) => c.trim());
  const firstRowLower = firstRowCells.map((c) => c.toLowerCase());
  const hasExplicitHeader = firstRowLower.some((h) => h === "telefone" || h === "phone");

  const headers = hasExplicitHeader
    ? firstRowLower
    : firstRowCells.map((_, index) => DEFAULT_HEADERS[index] ?? `coluna${index + 1}`);
  const dataLines = hasExplicitHeader ? lines.slice(1) : lines;

  const phoneIndex = headers.findIndex((h) => h === "telefone" || h === "phone");
  if (phoneIndex === -1) {
    throw new Error('CSV precisa de uma coluna "telefone" ou "phone".');
  }

  return dataLines.map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim());
    const variables: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (index !== phoneIndex && cells[index]) variables[header] = cells[index];
    });
    return { phone: cells[phoneIndex] ?? "", variables };
  });
}

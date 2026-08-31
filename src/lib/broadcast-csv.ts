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

/** Parser simples de CSV (cabeçalho na 1ª linha, vírgula como separador) — formato
 * controlado pelo admin que sobe o arquivo, sem precisar de lib externa. Exige uma
 * coluna "telefone" ou "phone"; as demais colunas viram variáveis do template. Não
 * normaliza o telefone (dígitos crus) — isso fica pro servidor (formatToWhatsAppNumber),
 * já que esse módulo também roda no cliente. */
export function parseBroadcastCsv(csv: string): ParsedBroadcastRecipient[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const phoneIndex = headers.findIndex((h) => h === "telefone" || h === "phone");
  if (phoneIndex === -1) {
    throw new Error('CSV precisa de uma coluna "telefone" ou "phone".');
  }

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const variables: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (index !== phoneIndex && cells[index]) variables[header] = cells[index];
    });
    return { phone: cells[phoneIndex] ?? "", variables };
  });
}

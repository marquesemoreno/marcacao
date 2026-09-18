/** Parser de CSV pra importar leads de MSP em lote (ver ImportMspLeadsCsvDialog) —
 * mesma ideia do parsePartnerLeadCsv (src/lib/partner-lead-csv.ts): colunas fixas
 * (batem com os campos do MspLead), cabeçalho reconhecível por alias. Compatível com
 * os CSVs já existentes em TIVDC/MSP/leads/*.csv (segmento, nome, bairro, telefone). */

export type ParsedMspLeadRow = {
  name: string;
  segment?: string;
  city?: string;
  channel?: string;
  phone: string;
  notes?: string;
};

type Field = keyof ParsedMspLeadRow;

const HEADER_ALIASES: Record<string, Field> = {
  nome: "name",
  empresa: "name",
  name: "name",
  clinica: "name",
  "clínica": "name",
  segmento: "segment",
  segment: "segment",
  categoria: "segment",
  category: "segment",
  cidade: "city",
  city: "city",
  canal: "channel",
  channel: "channel",
  origem: "channel",
  fonte: "channel",
  telefone: "phone",
  phone: "phone",
  whatsapp: "phone",
  celular: "phone",
  bairro: "notes",
  endereco: "notes",
  "endereço": "notes",
  address: "notes",
  observacoes: "notes",
  "observações": "notes",
  obs: "notes",
  notes: "notes",
};

// Excel/Sheets em pt-BR exporta CSV com ; (porque , é separador decimal) — mesma
// detecção usada em parseBroadcastCsv/parsePartnerLeadCsv.
function detectDelimiter(firstLine: string): "," | ";" | "\t" {
  if (firstLine.includes("\t")) return "\t";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseMspLeadCsv(csv: string): ParsedMspLeadRow[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV precisa de uma linha de cabeçalho e ao menos uma linha de dados.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = lines[0].split(delimiter).map((c) => c.trim().toLowerCase());
  const fields = headerCells.map((h) => HEADER_ALIASES[h] ?? null);

  if (!fields.includes("phone")) {
    throw new Error('CSV precisa de uma coluna de telefone ("telefone", "phone" ou "whatsapp").');
  }
  if (!fields.includes("name")) {
    throw new Error('CSV precisa de uma coluna de nome ("nome" ou "empresa").');
  }

  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim());
    const row: Partial<ParsedMspLeadRow> = {};
    fields.forEach((field, index) => {
      if (field && cells[index]) row[field] = cells[index];
    });
    return {
      name: row.name ?? "",
      segment: row.segment,
      city: row.city,
      channel: row.channel,
      phone: row.phone ?? "",
      notes: row.notes,
    };
  });
}

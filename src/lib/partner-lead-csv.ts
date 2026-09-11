/** Parser de CSV pra importar leads de parceria em lote (ver ImportLeadsCsvDialog) —
 * mesma ideia do parseBroadcastCsv (src/lib/broadcast-csv.ts), mas aqui as colunas
 * são fixas (bate com os campos do PartnerLead), não arbitrárias, então precisa de
 * cabeçalho reconhecível em vez de assumir ordem por posição. */

export type ParsedPartnerLeadRow = {
  clinicName: string;
  contactName?: string;
  phone: string;
  email?: string;
  neighborhood: string;
  specialties: string;
  notes?: string;
};

type Field = keyof ParsedPartnerLeadRow;

const HEADER_ALIASES: Record<string, Field> = {
  clinica: "clinicName",
  "clínica": "clinicName",
  clinicname: "clinicName",
  consultorio: "clinicName",
  "consultório": "clinicName",
  contato: "contactName",
  nome: "contactName",
  contactname: "contactName",
  responsavel: "contactName",
  "responsável": "contactName",
  telefone: "phone",
  phone: "phone",
  whatsapp: "phone",
  celular: "phone",
  email: "email",
  "e-mail": "email",
  bairro: "neighborhood",
  neighborhood: "neighborhood",
  regiao: "neighborhood",
  "região": "neighborhood",
  endereco: "neighborhood",
  "endereço": "neighborhood",
  address: "neighborhood",
  especialidades: "specialties",
  specialties: "specialties",
  exames: "specialties",
  categoria: "specialties",
  category: "specialties",
  observacoes: "notes",
  "observações": "notes",
  obs: "notes",
  notes: "notes",
};

// Excel/Sheets em pt-BR exporta CSV com ; (porque , é separador decimal) — mesma
// detecção usada em parseBroadcastCsv. Colar direto de uma planilha (Ctrl+C numas
// células, Ctrl+V aqui) vem com \t entre colunas, não , nem ; — sem checar tab
// antes, isso caía no fallback de vírgula e quebrava a detecção de cabeçalho.
function detectDelimiter(firstLine: string): "," | ";" | "\t" {
  if (firstLine.includes("\t")) return "\t";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parsePartnerLeadCsv(csv: string): ParsedPartnerLeadRow[] {
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
  if (!fields.includes("clinicName")) {
    throw new Error('CSV precisa de uma coluna de clínica ("clinica" ou "consultorio").');
  }

  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim());
    const row: Partial<ParsedPartnerLeadRow> = {};
    fields.forEach((field, index) => {
      if (field && cells[index]) row[field] = cells[index];
    });
    return {
      clinicName: row.clinicName ?? "",
      contactName: row.contactName,
      phone: row.phone ?? "",
      email: row.email,
      neighborhood: row.neighborhood ?? "",
      specialties: row.specialties ?? "",
      notes: row.notes,
    };
  });
}

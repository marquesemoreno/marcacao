/** Clínica como ela pode sair para a internet sem login (busca do site, página do
 * procedimento, guia do paciente). Auditoria de segurança 16/11/2026, M12: as actions
 * públicas devolviam o registro inteiro — CNPJ, comissão, ticket médio, ids de pacientes
 * excluídos de campanha, ponto geográfico da recepção e textos automáticos.
 *
 * Mantém o formato (as telas e os tipos não mudam) e esvazia o que não é público. Campo
 * novo no modelo Clinic NÃO sai sozinho: só o que está em PUBLIC_FIELDS passa. */
const PUBLIC_FIELDS = ["id", "name", "tradeName", "phone", "whatsapp", "address", "neighborhood", "city", "rating", "reviewCount", "businessHours"] as const;

/** Valor neutro por tipo — o que as telas públicas não leem. */
function blank(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [];
  if (value instanceof Date) return new Date(0);
  switch (typeof value) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return null; // Decimal, Json…
  }
}

export function toPublicClinic<T extends Record<string, unknown>>(clinic: T): T {
  const keep = new Set<string>(PUBLIC_FIELDS);
  return Object.fromEntries(Object.entries(clinic).map(([key, value]) => [key, keep.has(key) ? value : blank(value)])) as T;
}

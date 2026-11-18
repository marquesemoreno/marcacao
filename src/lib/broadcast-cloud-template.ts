/** Disparos pela API oficial: fora da janela de 24 h só sai modelo aprovado pela Meta, com
 * o texto fixo do modelo e só os campos {{1}}, {{2}}… variando. Cada campo da campanha
 * guarda o que vai nele — variável da planilha ({{nome}}) e/ou texto fixo. */
import { pickBroadcastVariant } from "@/lib/broadcast-variants";

/** Nome do modelo da Meta legível: "aviso_novos_medicos" → "Aviso novos medicos (marketing)". */
export function templateLabel(t: { name: string; category: string; language: string }): string {
  const name = t.name.replace(/_/g, " ");
  const cat = t.category === "MARKETING" ? "marketing" : t.category === "UTILITY" ? "utilidade" : t.category.toLowerCase();
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} (${cat}${t.language.startsWith("pt") ? "" : `, ${t.language}`})`;
}

export type CloudBroadcastMode ="TEXT" | "TEMPLATE" | "MISSING_TEMPLATE";

export function cloudBroadcastMode(input: { cloudActive: boolean; templateName: string | null }): CloudBroadcastMode {
  if (!input.cloudActive) return "TEXT";
  return input.templateName?.trim() ? "TEMPLATE" : "MISSING_TEMPLATE";
}

const VAR = /\{\{\s*([^}]+?)\s*\}\}/g;

function fill(source: string, variables: Record<string, string>): string {
  const lower = Object.fromEntries(Object.entries(variables).map(([k, v]) => [k.trim().toLowerCase(), v ?? ""]));
  return source.replace(VAR, (_, key: string) => lower[key.toLowerCase()] ?? "");
}

export function buildTemplateParams(
  sources: string[],
  variables: Record<string, string>
): { ok: true; params: string[] } | { ok: false; error: string } {
  const params: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    // A Meta recusa parâmetro vazio e parâmetro com quebra de linha/tab.
    const value = fill(sources[i], variables).replace(/\s+/g, " ").trim();
    if (!value) return { ok: false, error: `O campo {{${i + 1}}} do modelo ficou vazio para este paciente.` };
    params.push(value);
  }
  return { ok: true, params };
}

/** Confere, ao criar a campanha, se cada {{n}} do modelo tem valor e se as variáveis
 * usadas existem na planilha. Null = tudo certo. */
export function checkTemplateParamSources(variableCount: number, sources: string[], columns: string[]): string | null {
  const known = new Set(columns.map((c) => c.trim().toLowerCase()));
  for (let i = 0; i < variableCount; i++) {
    const source = sources[i]?.trim() ?? "";
    if (!source) return `Preencha o que vai em {{${i + 1}}} do modelo.`;
    for (const m of source.matchAll(VAR)) {
      if (!known.has(m[1].toLowerCase())) return `A planilha não tem a coluna {{${m[1]}}} (usada em {{${i + 1}}}).`;
    }
  }
  return null;
}

/** Texto como o paciente vai receber: corpo do modelo com os parâmetros no lugar. */
export function renderTemplatePreview(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (whole, n: string) => params[Number(n) - 1] ?? whole);
}

/** Modelo aprovado guardado na campanha (principal em cloudTemplate*, variações em
 * BroadcastCampaign.cloudTemplateVariants). */
export type CloudTemplateRef = { name: string; language: string; body: string };

export const MAX_CLOUD_TEMPLATES = 3;

/** Sorteio entre até 3 modelos aprovados (teste A/B/C): fixo por destinatário, pelo mesmo
 * hash das variações de texto — um reenvio após falha manda o mesmo modelo. index 0 = principal. */
export function pickCloudTemplate(main: CloudTemplateRef, extras: CloudTemplateRef[], recipientId: string): { index: number; template: CloudTemplateRef } {
  const all = [main, ...extras];
  const { index } = pickBroadcastVariant(all.map((t) => t.name), recipientId);
  return { index, template: all[index] ?? main };
}

/** Lê a lista Json do banco descartando entradas sem nome. */
export function parseCloudTemplateVariants(raw: unknown): CloudTemplateRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const o = v as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) return [];
    return [{ name, language: typeof o.language === "string" && o.language ? o.language : "pt_BR", body: typeof o.body === "string" ? o.body : "" }];
  });
}

/** Variações de modelo: no máximo 2 além do principal, sem repetir, e com o mesmo número de
 * campos {{n}} do principal (todas usam o que foi preenchido para o principal). Null = ok. */
export function checkCloudTemplateVariants(main: { name: string; variableCount: number }, extras: { name: string; variableCount: number }[]): string | null {
  if (extras.length + 1 > MAX_CLOUD_TEMPLATES) return `No máximo ${MAX_CLOUD_TEMPLATES} modelos por campanha.`;
  const seen = new Set([main.name]);
  for (const e of extras) {
    if (seen.has(e.name)) return `O modelo “${e.name}” está repetido.`;
    seen.add(e.name);
    if (e.variableCount !== main.variableCount) return `O modelo “${e.name}” tem ${e.variableCount} campo(s) {{n}} e o principal tem ${main.variableCount}: para sortear, todos precisam ter os mesmos campos.`;
  }
  return null;
}

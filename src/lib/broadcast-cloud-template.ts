/** Disparos pela API oficial: fora da janela de 24 h só sai modelo aprovado pela Meta, com
 * o texto fixo do modelo e só os campos {{1}}, {{2}}… variando. Cada campo da campanha
 * guarda o que vai nele — variável da planilha ({{nome}}) e/ou texto fixo. */

export type CloudBroadcastMode = "TEXT" | "TEMPLATE" | "MISSING_TEMPLATE";

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

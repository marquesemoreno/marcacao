/** Monta os `components` de um modelo novo da API oficial (POST /{waba_id}/message_templates):
 * texto (BODY) com exemplos das variáveis, rodapé opcional (FOOTER) e até 3 botões de resposta
 * rápida (QUICK_REPLY). Confere os limites da Meta antes de enviar, para o erro sair em português
 * na tela em vez de um código da Graph API. */

export const TEMPLATE_BODY_MAX = 1024;
export const TEMPLATE_FOOTER_MAX = 60;
export const TEMPLATE_BUTTON_MAX = 25;
export const TEMPLATE_MAX_BUTTONS = 3;

type Component =
  | { type: "HEADER"; format: "IMAGE"; example: { header_handle: string[] } }
  | { type: "BODY"; text: string; example?: { body_text: string[][] } }
  | { type: "FOOTER"; text: string }
  | { type: "BUTTONS"; buttons: { type: "QUICK_REPLY"; text: string }[] };

export function buildTemplateComponents(input: {
  body: string;
  examples: string[];
  footer?: string;
  buttons?: string[];
  /** Handle devolvido pelo upload da foto (Resumable Upload da Meta) — vira cabeçalho IMAGE. */
  headerImageHandle?: string;
}): { ok: true; components: Component[] } | { ok: false; error: string } {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Escreva o texto do modelo." };
  if (body.length > TEMPLATE_BODY_MAX) return { ok: false, error: `O texto passa de ${TEMPLATE_BODY_MAX} caracteres.` };

  const vars = new Set(body.match(/\{\{\d+\}\}/g) ?? []).size;
  const examples = input.examples.slice(0, vars).map((e) => e.trim());
  if (examples.length < vars || examples.some((e) => !e)) {
    return { ok: false, error: `Preencha um exemplo para cada variável ({{1}} até {{${vars}}}).` };
  }

  const components: Component[] = [];
  if (input.headerImageHandle) components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [input.headerImageHandle] } });
  components.push({ type: "BODY", text: body, ...(vars ? { example: { body_text: [examples] } } : {}) });

  const footer = input.footer?.trim() ?? "";
  if (footer) {
    if (footer.length > TEMPLATE_FOOTER_MAX) return { ok: false, error: `O rodapé passa de ${TEMPLATE_FOOTER_MAX} caracteres.` };
    if (/\{\{\d+\}\}/.test(footer)) return { ok: false, error: "O rodapé não pode ter variável ({{1}})." };
    components.push({ type: "FOOTER", text: footer });
  }

  const buttons = (input.buttons ?? []).map((b) => b.trim()).filter(Boolean);
  if (buttons.length > TEMPLATE_MAX_BUTTONS) return { ok: false, error: `No máximo ${TEMPLATE_MAX_BUTTONS} botões.` };
  if (buttons.some((b) => b.length > TEMPLATE_BUTTON_MAX)) return { ok: false, error: `Cada botão tem no máximo ${TEMPLATE_BUTTON_MAX} caracteres.` };
  if (new Set(buttons.map((b) => b.toLowerCase())).size !== buttons.length) return { ok: false, error: "Dois botões com o mesmo texto." };
  if (buttons.length) components.push({ type: "BUTTONS", buttons: buttons.map((text) => ({ type: "QUICK_REPLY" as const, text })) });

  return { ok: true, components };
}

/** Parâmetros do envio de um modelo aprovado: foto do cabeçalho (link público/assinado), se o
 * modelo tiver, e os valores de {{1}}, {{2}}… do texto. */
export function templateSendComponents(bodyParams: string[], headerImageLink?: string | null) {
  const out: ({ type: "header"; parameters: { type: "image"; image: { link: string } }[] } | { type: "body"; parameters: { type: "text"; text: string }[] })[] = [];
  if (headerImageLink) out.push({ type: "header", parameters: [{ type: "image", image: { link: headerImageLink } }] });
  if (bodyParams.length) out.push({ type: "body", parameters: bodyParams.map((text) => ({ type: "text" as const, text })) });
  return out;
}

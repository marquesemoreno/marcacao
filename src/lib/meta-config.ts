/** Identificadores PÚBLICOS do app "chat" da TIVDC na Meta (vão no navegador pro botão
 * do Embedded Signup) — não são segredo. O App Secret fica só no servidor (META_APP_SECRET).
 * Dá pra sobrescrever por env se um dia trocar de app/configuração. */
export const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "1854106501874471";

/** Configuração do Login do Facebook para Empresas do tipo "Cadastro incorporado do
 * WhatsApp" (token de usuário do sistema que nunca expira; ativo: contas do WhatsApp;
 * permissões whatsapp_business_management + whatsapp_business_messaging). Criada em
 * 07/10/2026. */
export const META_ES_CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID ?? "4592472154362883";

export const META_GRAPH_VERSION = "v23.0";

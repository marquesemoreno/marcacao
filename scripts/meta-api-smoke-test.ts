/** Chamadas reais na Cloud API com o token da WABA conectada — registra uso das permissões
 * whatsapp_business_management (GET WABA, phone_numbers, message_templates) e
 * whatsapp_business_messaging (envio de 1 modelo) antes de reenviar a análise do app.
 * Nunca imprime o token.
 *
 * Uso: npx tsx scripts/meta-api-smoke-test.ts <telefone-destino> [--clinic <clinicId>] [--template hello_world] [--lang en_US] [--param valor ...]
 * Ex.:  npx tsx scripts/meta-api-smoke-test.ts 5577999998888
 * Env:  DATABASE_URL, WHATSAPP_TOKEN_ENCRYPTION_KEY, META_GRAPH_VERSION (opcional). */
import { PrismaClient } from "@prisma/client";
import { decryptToken } from "../src/lib/token-crypto";

const args = process.argv.slice(2);
const to = args.find((a) => /^\+?\d{10,15}$/.test(a))?.replace(/\D/g, "");
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const params = args.flatMap((a, i) => (a === "--param" ? [args[i + 1]] : []));
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v23.0"}`;
const prisma = new PrismaClient();

async function call(label: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  const ok = res.ok && !(json as { error?: unknown }).error;
  console.log(`\n${ok ? "OK  " : "ERRO"} ${label}  (HTTP ${res.status})`);
  console.log(JSON.stringify(json, null, 2).slice(0, 1500));
  return { ok, json };
}

async function main() {
  if (!to) {
    console.error("Informe o telefone de destino com DDI: npx tsx scripts/meta-api-smoke-test.ts 5577999998888");
    process.exit(1);
  }
  const clinicId = flag("clinic");
  const account = clinicId
    ? await prisma.whatsappCloudAccount.findUnique({ where: { clinicId } })
    : await prisma.whatsappCloudAccount.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!account) throw new Error("Nenhuma conta da Cloud API conectada (conecte em /admin/whatsapp).");
  const token = decryptToken(account.accessToken);
  console.log(`WABA ${account.wabaId} · número ${account.displayPhoneNumber ?? account.phoneNumberId} (${account.phoneNumberId})`);

  // whatsapp_business_management
  await call("GET WABA", `${account.wabaId}?fields=id,name,timezone_id,message_template_namespace`, token);
  await call("GET phone_numbers", `${account.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`, token);
  await call("GET message_templates", `${account.wabaId}/message_templates?fields=name,status,category,language&limit=20`, token);

  // whatsapp_business_messaging
  const template = flag("template") ?? "hello_world";
  const language = flag("lang") ?? "en_US";
  await call(`POST messages (template ${template})`, `${account.phoneNumberId}/messages`, token, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template,
      language: { code: language },
      ...(params.length ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] } : {}),
    },
  });
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/** Conecta o NÚMERO DE TESTE da Meta (painel do app › WhatsApp › Configuração da API) a uma
 * clínica, sem Embedded Signup — pra testar envio, status por webhook e modelos.
 * A conta fica INATIVA (active=false): o Chat da clínica continua no WhatsApp Web; só as
 * telas /admin/whatsapp/enviar e /templates e o smoke test usam a Cloud API.
 * O token NUNCA vai na linha de comando nem no chat: vem da env META_TEST_TOKEN.
 *
 * Uso (PowerShell):
 *   $env:META_TEST_TOKEN = "<token temporário do painel>"
 *   npx tsx scripts/connect-meta-test-number.ts --waba <WABA_ID> --phone <PHONE_NUMBER_ID> [--clinic <clinicId>]
 * Sem --clinic, lista as clínicas. */
import { PrismaClient } from "@prisma/client";
import { encryptToken } from "../src/lib/token-crypto";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v23.0"}`;
const prisma = new PrismaClient();

async function main() {
  const clinicId = flag("clinic");
  if (!clinicId) {
    const clinics = await prisma.clinic.findMany({
      select: { id: true, tradeName: true, whatsappCloudAccount: { select: { phoneNumberId: true, active: true } } },
      orderBy: { tradeName: "asc" },
    });
    for (const c of clinics) console.log(c.id, c.tradeName, c.whatsappCloudAccount ? `(já tem Cloud: ${c.whatsappCloudAccount.phoneNumberId}, active=${c.whatsappCloudAccount.active})` : "");
    console.log("\nRode de novo com --clinic <id>.");
    return;
  }
  const token = process.env.META_TEST_TOKEN;
  const wabaId = flag("waba");
  const phoneNumberId = flag("phone");
  if (!token || !wabaId || !phoneNumberId) {
    console.error("Faltam META_TEST_TOKEN (env), --waba ou --phone.");
    process.exit(1);
  }
  if (!process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY) {
    console.error("Falta WHATSAPP_TOKEN_ENCRYPTION_KEY no .env (mesmo valor da Vercel).");
    process.exit(1);
  }

  const res = await fetch(`${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const info = (await res.json()) as { display_phone_number?: string; verified_name?: string; error?: { message: string } };
  if (!res.ok || info.error) {
    console.error("A Meta recusou o token/número:", info.error?.message ?? res.status);
    process.exit(1);
  }
  console.log("Número de teste:", info.display_phone_number, "·", info.verified_name);

  // Assina o app nos webhooks da WABA de teste (status de entrega e mensagens recebidas).
  const sub = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  console.log("Webhook da WABA:", sub.ok ? "assinado" : `falhou (HTTP ${sub.status})`);

  const data = {
    wabaId,
    phoneNumberId,
    displayPhoneNumber: info.display_phone_number ?? null,
    verifiedName: info.verified_name ?? null,
    accessToken: encryptToken(token),
    coexistence: false,
    active: false,
  };
  await prisma.whatsappCloudAccount.upsert({ where: { clinicId }, create: { clinicId, ...data }, update: data });
  console.log(`Conectado à clínica ${clinicId} (inativo no Chat). Teste em /admin/whatsapp/enviar.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Cifra em repouso as chaves de integração ainda gravadas em texto puro
 * (auditoria de segurança 16/11/2026, M6):
 *   - WhatsappInstance.apiKey      (Evolution, conexão por QR)
 *   - HospitalIntegration.apiToken (pontes Firebird das clínicas)
 *   - InstagramAccount.accessToken (Direct do Instagram)
 *
 * Usa a mesma chave da API oficial (WHATSAPP_TOKEN_ENCRYPTION_KEY — tem que ser O MESMO
 * valor da Vercel, senão o site não consegue ler o que este script gravar).
 * O código já lê valor antigo em texto puro, então rodar este script é seguro a qualquer
 * momento depois do deploy — e rodar duas vezes não faz nada na segunda.
 *
 * Nunca imprime os valores, só contagens.
 *
 *   npx tsx scripts/encrypt-integration-secrets.ts            (só mostra o que faria)
 *   npx tsx scripts/encrypt-integration-secrets.ts --apply    (grava)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { decryptToken, encryptToken, isEncryptedToken } from "../src/lib/token-crypto";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

/** Cifra e confere que volta igual antes de gravar. */
function seal(plain: string): string {
  const sealed = encryptToken(plain);
  if (decryptToken(sealed) !== plain) throw new Error("Conferência da cifra falhou — nada gravado.");
  return sealed;
}

async function main() {
  if (!process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY) {
    throw new Error("Falta WHATSAPP_TOKEN_ENCRYPTION_KEY no .env (mesmo valor da Vercel).");
  }
  seal("teste"); // chave válida?

  const instances = (await prisma.whatsappInstance.findMany({ select: { id: true, apiKey: true } })).filter((r) => r.apiKey && !isEncryptedToken(r.apiKey));
  const bridges = (await prisma.hospitalIntegration.findMany({ select: { id: true, apiToken: true } })).filter((r) => r.apiToken && !isEncryptedToken(r.apiToken));
  const instagram = (await prisma.instagramAccount.findMany({ select: { id: true, accessToken: true } })).filter((r) => r.accessToken && !isEncryptedToken(r.accessToken));

  console.log(`Em texto puro: ${instances.length} instância(s) da Evolution, ${bridges.length} ponte(s), ${instagram.length} conta(s) do Instagram.`);
  if (!apply) {
    console.log("Nada gravado. Rode com --apply para cifrar.");
    return;
  }

  for (const r of instances) await prisma.whatsappInstance.update({ where: { id: r.id }, data: { apiKey: seal(r.apiKey) } });
  for (const r of bridges) await prisma.hospitalIntegration.update({ where: { id: r.id }, data: { apiToken: seal(r.apiToken) } });
  // Só grava se ninguém trocou o token no meio (o cron de renovação também grava este campo).
  for (const r of instagram) await prisma.instagramAccount.updateMany({ where: { id: r.id, accessToken: r.accessToken }, data: { accessToken: seal(r.accessToken) } });

  console.log("Pronto: tudo cifrado.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Falhou.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

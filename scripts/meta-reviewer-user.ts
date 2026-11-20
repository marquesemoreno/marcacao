/** Login do analista da Meta (App Review do Instagram) na clínica TIVDC.
 *
 * Cria um usuário de GESTÃO só para a revisão — nunca use o seu login pessoal no formulário da
 * Meta. A senha é gerada aqui e aparece UMA vez no terminal (não é gravada em arquivo): copie
 * direto para o campo "instruções para o analista". Terminada a revisão, desative.
 *
 * Sem --confirmar só mostra o que faria.
 *
 *   npx tsx --conditions=react-server scripts/meta-reviewer-user.ts --confirmar              (cria; ou reativa se já existe)
 *   npx tsx --conditions=react-server scripts/meta-reviewer-user.ts --nova-senha --confirmar (troca a senha e derruba sessões)
 *   npx tsx --conditions=react-server scripts/meta-reviewer-user.ts --desativar --confirmar  (depois da aprovação)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { DEMO_CLINIC_CNPJ } from "../src/lib/demo-clinic";

const prisma = new PrismaClient();

const EMAIL = "revisor.meta@conectasaudevc.com.br";
const NAME = "Meta Reviewer";
const CLINIC_TEXT = "TIVDC";

const args = process.argv.slice(2);
const CONFIRM = args.includes("--confirmar");
const NEW_PASSWORD = args.includes("--nova-senha");
const DEACTIVATE = args.includes("--desativar");

/** Senha forte sem caracteres que confundem ao copiar (0/O, 1/l/I). */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(18);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 6)}-${out.slice(6, 12)}-${out.slice(12, 18)}`;
}

async function main() {
  console.log(CONFIRM ? "Modo: GRAVANDO no banco.\n" : "Modo: só mostrando (acrescente --confirmar para gravar).\n");

  const clinics = await prisma.clinic.findMany({
    where: { OR: [{ tradeName: { contains: CLINIC_TEXT, mode: "insensitive" } }, { name: { contains: CLINIC_TEXT, mode: "insensitive" } }] },
    select: { id: true, tradeName: true, cnpj: true },
  });
  const usable = clinics.filter((c) => c.cnpj !== DEMO_CLINIC_CNPJ);
  if (usable.length !== 1) throw new Error(`Esperava 1 clínica com "${CLINIC_TEXT}" no nome, achei ${usable.length}: ${usable.map((c) => c.tradeName).join(", ")}`);
  const clinic = usable[0];

  const existing = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, clinicId: true, active: true } });
  if (existing && existing.clinicId !== clinic.id) throw new Error(`${EMAIL} já existe em outra clínica — não mexi.`);

  if (DEACTIVATE) {
    if (!existing) return console.log("Usuário não existe — nada a desativar.");
    if (CONFIRM) {
      await prisma.user.update({ where: { id: existing.id }, data: { active: false, sessionVersion: { increment: 1 } } });
    }
    return console.log(`${CONFIRM ? "✔" : "→ faria:"} desativar ${EMAIL} (e derrubar as sessões abertas).`);
  }

  const password = !existing || NEW_PASSWORD ? generatePassword() : null;
  if (!CONFIRM) {
    console.log(`→ faria: ${existing ? "reativar" : "criar"} ${EMAIL} (Gestão) em ${clinic.tradeName}${password ? " com senha nova" : ""}.`);
    return;
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { active: true, ...(passwordHash ? { passwordHash, sessionVersion: { increment: 1 } } : {}) },
    });
  } else {
    await prisma.user.create({
      data: { name: NAME, email: EMAIL, passwordHash: passwordHash!, role: "CLINIC", clinicId: clinic.id, isAttendant: true, isManager: true, clinicRole: "GESTAO" },
    });
  }

  console.log(`✔ ${existing ? "Reativado" : "Criado"}: ${EMAIL} (Gestão) em ${clinic.tradeName}.`);
  if (password) {
    console.log(`\n  E-mail: ${EMAIL}\n  Senha:  ${password}\n`);
    console.log("  A senha não fica salva em lugar nenhum. Copie agora para o formulário da Meta.");
    console.log("  Esqueceu? Rode de novo com --nova-senha --confirmar.");
  } else {
    console.log("  Senha mantida (use --nova-senha para gerar outra).");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

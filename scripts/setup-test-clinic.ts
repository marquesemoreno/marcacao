/** Clínica de TESTE (não confundir com a de demonstração dos vídeos).
 *
 * Para que serve: testar com WhatsApp de verdade o que a clínica demo não executa — automações,
 * régua, resposta de convênios, tarefas criadas por automação. A demo tem uma trava pelo CNPJ
 * (nada roda nem envia); esta clínica não tem, ela se comporta como a de um cliente.
 *
 * O que o script faz:
 *  1. Cria a "Clínica Teste" (CNPJ fixo, fictício) com um usuário de gestão e um de recepção,
 *     se ainda não existir. NUNCA apaga nada: pode rodar de novo sem perder os testes.
 *  2. Opcional: move o número da API oficial de outra clínica para ela (ou devolve). Só troca
 *     de dono no nosso banco — mantém o token, então não precisa refazer a autorização da Meta.
 *     O "Desconectar" do painel admin apaga o token; por isso mover por aqui é melhor.
 *
 * Sem --confirmar o script só MOSTRA o que faria. Nada é gravado.
 *
 * Uso:
 *   npx tsx --conditions=react-server scripts/setup-test-clinic.ts
 *   npx tsx --conditions=react-server scripts/setup-test-clinic.ts --confirmar
 *   npx tsx --conditions=react-server scripts/setup-test-clinic.ts --mover-numero-de "TIVDC" --confirmar
 *   npx tsx --conditions=react-server scripts/setup-test-clinic.ts --devolver-numero-para "TIVDC" --confirmar
 *
 * Senha dos logins: env TEST_CLINIC_PASSWORD; se faltar, o script gera uma e grava no .env local. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { appendFileSync } from "fs";
import { DEMO_CLINIC_CNPJ } from "../src/lib/demo-clinic";

const prisma = new PrismaClient();

export const TEST_CLINIC_CNPJ = "00.000.000/0002-81";
const DOMAIN = "clinicateste.test";
const MANAGER_EMAIL = `gestao@${DOMAIN}`;
const RECEPTION_EMAIL = `recepcao@${DOMAIN}`;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? "").trim() : "";
};
const CONFIRM = flag("--confirmar");
const MOVE_FROM = value("--mover-numero-de");
const RETURN_TO = value("--devolver-numero-para");

const say = (line: string) => console.log(line);
const would = (line: string) => say(`${CONFIRM ? "✔" : "→ faria:"} ${line}`);

/** Uma clínica pelo trecho do nome. Recusa a demo, a própria clínica de teste e nome ambíguo. */
async function findClinicByName(text: string, testClinicId: string | null) {
  const found = await prisma.clinic.findMany({
    where: { OR: [{ tradeName: { contains: text, mode: "insensitive" } }, { name: { contains: text, mode: "insensitive" } }] },
    select: { id: true, tradeName: true, cnpj: true },
  });
  const usable = found.filter((c) => c.cnpj !== DEMO_CLINIC_CNPJ && c.id !== testClinicId);
  if (usable.length === 0) throw new Error(`Nenhuma clínica com "${text}" no nome (a demo e a de teste não contam).`);
  if (usable.length > 1) throw new Error(`"${text}" bate com mais de uma clínica: ${usable.map((c) => c.tradeName).join(", ")}. Use um trecho mais específico.`);
  return usable[0];
}

async function main() {
  if (MOVE_FROM && RETURN_TO) throw new Error("Use --mover-numero-de OU --devolver-numero-para, não os dois.");
  say(CONFIRM ? "Modo: GRAVANDO no banco.\n" : "Modo: só mostrando. Nada será gravado (acrescente --confirmar para gravar).\n");

  // Situação atual das contas da API oficial, para você conferir antes de mover.
  const accounts = await prisma.whatsappCloudAccount.findMany({
    select: { clinicId: true, displayPhoneNumber: true, verifiedName: true, active: true, coexistence: true, clinic: { select: { tradeName: true } } },
  });
  say("Números da API oficial hoje:");
  if (accounts.length === 0) say("  (nenhum)");
  for (const a of accounts) {
    say(`  • ${a.clinic.tradeName}: ${a.displayPhoneNumber ?? "número sem exibição"} — ${a.active ? "ativo" : "inativo"}${a.coexistence ? ", coexistência" : ""}${a.verifiedName ? ` (${a.verifiedName})` : ""}`);
  }
  say("");

  // 1. Clínica de teste
  let clinic = await prisma.clinic.findUnique({ where: { cnpj: TEST_CLINIC_CNPJ }, select: { id: true, tradeName: true } });
  if (clinic) {
    say(`Clínica de teste já existe: ${clinic.tradeName}. Não mexi em nada dela.`);
  } else {
    would("criar a Clínica Teste, com responsável técnico fictício, um usuário de gestão e um de recepção.");
    if (CONFIRM) {
      const password = process.env.TEST_CLINIC_PASSWORD || randomBytes(9).toString("base64url");
      if (!process.env.TEST_CLINIC_PASSWORD) appendFileSync(".env", `\nTEST_CLINIC_PASSWORD="${password}"\n`);
      const hash = await bcrypt.hash(password, 10);
      clinic = await prisma.clinic.create({
        data: {
          name: "Clínica Teste Ltda (ambiente de testes)",
          tradeName: "Clínica Teste",
          cnpj: TEST_CLINIC_CNPJ,
          whatsapp: "550000000000",
          address: "Rua de Teste, 1",
          neighborhood: "Centro",
          city: "Vitória da Conquista",
          commissionRate: 0,
          listedInMarketplace: false,
          defaultTicket: 250,
          technicalDirectorName: "Responsável de Teste",
          technicalDirectorCrm: "CRM 000000 (teste)",
        },
        select: { id: true, tradeName: true },
      });
      await prisma.user.create({
        data: { name: "Gestão Teste", email: MANAGER_EMAIL, passwordHash: hash, role: "CLINIC", clinicId: clinic.id, isAttendant: true, isManager: true, clinicRole: "GESTAO" },
      });
      await prisma.user.create({
        data: { name: "Recepção Teste", email: RECEPTION_EMAIL, passwordHash: hash, role: "CLINIC", clinicId: clinic.id, isAttendant: true, clinicRole: "RECEPCAO" },
      });
      say(`  Logins: ${MANAGER_EMAIL} (gestão) e ${RECEPTION_EMAIL} (recepção).`);
      say(`  Senha: está em TEST_CLINIC_PASSWORD no arquivo .env deste computador.`);
    }
  }

  // 2. Mover ou devolver o número da API oficial
  const testId = clinic?.id ?? null;
  if (MOVE_FROM || RETURN_TO) {
    const other = await findClinicByName(MOVE_FROM || RETURN_TO, testId);
    const fromName = MOVE_FROM ? other.tradeName : "Clínica Teste";
    const toName = MOVE_FROM ? "Clínica Teste" : other.tradeName;
    const fromId = MOVE_FROM ? other.id : testId;
    const toId = MOVE_FROM ? testId : other.id;

    const fromAccount = fromId ? accounts.find((a) => a.clinicId === fromId) : undefined;
    const toAccount = toId ? accounts.find((a) => a.clinicId === toId) : undefined;
    // Sem --confirmar a clínica de teste pode ainda não existir: aí só descreve.
    if (fromId && !fromAccount) throw new Error(`${fromName} não tem número da API oficial conectado.`);
    if (toAccount) throw new Error(`${toName} já tem um número da API oficial (${toAccount.displayPhoneNumber ?? "sem exibição"}). Cada clínica só pode ter um.`);

    would(`mover o número ${fromAccount?.displayPhoneNumber ?? "(da API oficial)"} de ${fromName} para ${toName}, mantendo o token.`);
    say(`  ${fromName} fica sem API oficial. As conversas antigas desse número continuam em ${fromName}.`);
    if (CONFIRM) {
      if (!fromId || !toId) throw new Error("Clínica de teste não encontrada.");
      await prisma.whatsappCloudAccount.update({ where: { clinicId: fromId }, data: { clinicId: toId } });
      if (MOVE_FROM && fromAccount?.displayPhoneNumber) {
        await prisma.clinic.update({ where: { id: toId }, data: { whatsapp: fromAccount.displayPhoneNumber.replace(/\D/g, "") } });
      }
      say("  Feito. Mensagens novas nesse número já entram na clínica de destino.");
    }
  } else if (!accounts.some((a) => a.clinicId === testId)) {
    say('\nA Clínica Teste está sem número. Para trazer o da API oficial: --mover-numero-de "<trecho do nome da clínica de origem>".');
  }

  say(CONFIRM ? "\nPronto." : "\nNada foi gravado. Se o plano acima está certo, rode de novo com --confirmar.");
}

main()
  .catch((e) => {
    console.error(`\nErro: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

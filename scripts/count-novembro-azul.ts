/**
 * Público do Novembro Azul da Urolaser — SÓ LEITURA (não cria campanha, não envia nada).
 *
 * Puxa os pacientes homens do sistema da clínica (Firebird, pela ponte — o PC da Urolaser
 * precisa estar LIGADO, então rode em horário comercial), aplica as mesmas regras do Disparos
 * (telefone válido, sem "sair", fora da lista de exclusão) e cruza com o consentimento de
 * marketing da Urolaser (campanha de marketing só vai para quem autorizou).
 *
 *   npx tsx --conditions=react-server scripts/count-novembro-azul.ts
 *   npx tsx --conditions=react-server scripts/count-novembro-azul.ts --meses 36
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { fetchBridgeCampaignPatients } from "../src/lib/hospital-bridge";
import { buildCampaignAudience } from "../src/lib/campaign-audience";
import { toggleNinthDigit } from "../src/lib/whatsapp";

// Preço da Meta por mensagem de MARKETING no Brasil (calculadora, vigente desde 01/07/2026).
// Confira a tabela atual antes de fechar orçamento.
const MARKETING_BRL = 0.3217;

const mesesArg = process.argv.indexOf("--meses");
const MESES = mesesArg > 0 ? Number(process.argv[mesesArg + 1]) || 24 : 24;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const clinic = await prisma.clinic.findFirst({
    where: { tradeName: { contains: "Urolaser", mode: "insensitive" } },
    select: { id: true, tradeName: true, campaignExcludedPatientIds: true },
  });
  if (!clinic) throw new Error("Clínica Urolaser não encontrada.");

  const since = new Date();
  since.setMonth(since.getMonth() - MESES);
  const { patients } = await fetchBridgeCampaignPatients(clinic.id, { sexo: "M", desde: since.toISOString().slice(0, 10) });

  const optedOutPhones = new Set(
    (await prisma.contact.findMany({ where: { optedOutOfBroadcastsAt: { not: null }, phone: { not: null } }, select: { phone: true } }))
      .map((c) => c.phone)
      .filter((p): p is string => !!p)
  );
  const consented = new Set(
    (
      await prisma.contactClinicProfile.findMany({
        where: { clinicId: clinic.id, marketingConsentAt: { not: null }, contact: { phone: { not: null } } },
        select: { contact: { select: { phone: true } } },
      })
    )
      .map((p) => p.contact.phone)
      .filter((p): p is string => !!p)
  );
  const hasConsent = (phone: string) => { const alt = toggleNinthDigit(phone); return consented.has(phone) || (!!alt && consented.has(alt)); };

  console.log(`\n${clinic.tradeName} — homens com marcação nos últimos ${MESES} meses (sistema da clínica): ${patients.length}`);
  console.log(`Pacientes da Urolaser com consentimento de marketing (todos, qualquer sexo): ${consented.size}\n`);

  for (const minAge of [undefined, 40, 45, 50]) {
    const { recipients, stats } = buildCampaignAudience(patients, {
      minAge,
      optedOutPhones,
      excludedPatientIds: new Set(clinic.campaignExcludedPatientIds),
    });
    const withConsent = recipients.filter((r) => hasConsent(r.phone)).length;
    console.log(`Faixa: ${minAge ? `${minAge}+ anos` : "todas as idades"}`);
    console.log(`  público válido (WhatsApp ok, sem "sair"):  ${recipients.length}`);
    console.log(`  com consentimento de marketing (recebem):  ${withConsent}  → custo ≈ ${brl(withConsent * MARKETING_BRL)}`);
    console.log(`  se todos tivessem consentimento:           custo ≈ ${brl(recipients.length * MARKETING_BRL)}`);
    console.log(`  detalhes: ${JSON.stringify(stats)}\n`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
